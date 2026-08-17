import { Pool } from "pg";

let controlPool: Pool | null = null;
const orgPools = new Map<string, Pool>();

function createPoolFromEnv(overrideDbName?: string): Pool {
  const { DATABASE_URL, PGHOST, PGUSER, PGPASSWORD, PGPORT, PGDATABASE } = process.env;
  if (!DATABASE_URL && !(PGHOST && PGUSER && PGDATABASE)) {
    throw new Error("Postgres DB not configured (DATABASE_URL or PG* required)");
  }

  let connectionString = DATABASE_URL;
  if (overrideDbName && DATABASE_URL) {
    const url = new URL(DATABASE_URL);
    url.pathname = `/${overrideDbName}`;
    connectionString = url.toString();
  }

  return new Pool({
    connectionString,
    host: connectionString ? undefined : PGHOST,
    user: connectionString ? undefined : PGUSER,
    password: connectionString ? undefined : PGPASSWORD,
    port: connectionString ? undefined : (PGPORT ? Number(PGPORT) : undefined),
    database: connectionString ? undefined : (overrideDbName || PGDATABASE),
    max: overrideDbName ? 5 : 10, // org pools capped smaller than the control pool
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

/**
 * The control-plane pool -- connects to the shared "reliabilityos" database
 * that holds ONLY organizations/org_users (migration 008). Never holds
 * operational data (assets, alerts, etc.) for any real org going forward.
 */
export async function getPgPool(): Promise<Pool> {
  if (controlPool) return controlPool;
  controlPool = createPoolFromEnv();
  await controlPool.query("SELECT 1");
  return controlPool;
}

export function getPgPoolOrThrow(): Pool {
  if (!controlPool) throw new Error("Postgres pool not initialized");
  return controlPool;
}

/**
 * Resolves and caches a pool for one organization's own database, by
 * organization id. Looks up db_name from the control-plane organizations
 * table on first use, then reuses the same pool for that org afterward.
 */
export async function getOrgPool(organizationId: string): Promise<Pool> {
  const existing = orgPools.get(organizationId);
  if (existing) return existing;

  const control = getPgPoolOrThrow();
  const { rows } = await control.query<{ db_name: string }>(
    `SELECT db_name FROM organizations WHERE id = $1`,
    [organizationId],
  );
  if (rows.length === 0) {
    throw new Error(`No organization found for id ${organizationId}`);
  }

  const pool = createPoolFromEnv(rows[0].db_name);
  await pool.query("SELECT 1"); // fail loudly if this org's DB is unreachable
  orgPools.set(organizationId, pool);
  return pool;
}

/**
 * Control-plane lookup: which organization does this email belong to?
 * Used at login time, before we know which org's database to check the
 * password against. Returns null if the email isn't registered anywhere.
 */
export async function lookupOrgForEmail(
  email: string,
): Promise<{ organizationId: string; dbName: string } | null> {
  const control = getPgPoolOrThrow();
  const { rows } = await control.query<{ organization_id: string; db_name: string }>(
    `SELECT ou.organization_id, o.db_name
     FROM org_users ou
     JOIN organizations o ON o.id = ou.organization_id
     WHERE ou.email = $1`,
    [email.toLowerCase().trim()],
  );
  if (rows.length === 0) return null;
  return { organizationId: rows[0].organization_id, dbName: rows[0].db_name };
}
