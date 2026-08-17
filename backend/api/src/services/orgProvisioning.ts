import { Pool } from "pg";
import fs from "fs";
import path from "path";

// Migrations that belong in every PER-ORG database, in order.
// 008_organizations.sql is deliberately excluded -- that one is
// control-plane-only and lives in the shared reliabilityos database.
const ORG_MIGRATION_FILES = [
  "init.sql",
  "002_alerts_assets_sensors.sql",
  "003_users.sql",
  "004_sensor_readings_and_workorder_links.sql",
  "005_route_and_fk_integrity.sql",
  "006_asset_pipe_specs.sql",
  "007_asset_incidents.sql",
  "009_user_provisioning.sql",
];

// ASSUMPTION, not yet verified live: this resolves relative to
// process.cwd(), which should be backend/api when the server is started
// via `npm run dev` from that folder. If migration files fail to be found,
// this path is the first thing to check.
function migrationsDir(): string {
  return path.resolve(process.cwd(), "../../infra/postgres");
}

// Postgres identifiers can't be parameterized in CREATE DATABASE / DROP
// DATABASE. This regex is the entire injection defense -- the db name is
// generated here, server-side, and NEVER taken directly from client input.
const SAFE_DB_NAME = /^[a-z][a-z0-9_]{2,50}$/;

function slugify(orgName: string): string {
  return orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

function generateDbName(orgName: string): string {
  const slug = slugify(orgName) || "org";
  const suffix = Math.random().toString(16).slice(2, 8); // 6 hex chars
  const dbName = `reliabilityos_${slug}_${suffix}`;
  if (!SAFE_DB_NAME.test(dbName)) {
    // Should be unreachable given slugify's own character stripping, but
    // this is the actual security boundary -- never proceed past it silently.
    throw new Error(`Generated db name failed safety check: ${dbName}`);
  }
  return dbName;
}

// Builds a connection string pointed at a specific database, reusing the
// same host/user/password as the main app connection.
function buildConnectionStringForDb(dbName: string): string {
  const { DATABASE_URL, PGHOST, PGUSER, PGPASSWORD, PGPORT } = process.env;
  if (DATABASE_URL) {
    const url = new URL(DATABASE_URL);
    url.pathname = `/${dbName}`;
    return url.toString();
  }
  if (!(PGHOST && PGUSER)) {
    throw new Error("Cannot build per-org connection string: no DATABASE_URL or PG* vars set");
  }
  const auth = PGPASSWORD ? `${PGUSER}:${encodeURIComponent(PGPASSWORD)}` : PGUSER;
  return `postgresql://${auth}@${PGHOST}:${PGPORT || 5432}/${dbName}`;
}

export interface ProvisionResult {
  organizationId: string;
  name: string;
  dbName: string;
}

// controlPool = existing pool connected to the shared "reliabilityos" DB
// (holds the organizations/org_users tables from migration 008).
export async function provisionOrganization(controlPool: Pool, orgName: string): Promise<ProvisionResult> {
  const dbName = generateDbName(orgName);

  // 1. Create the new database. Cannot run inside a transaction, cannot be
  // parameterized -- dbName is safe because of the regex check above.
  await controlPool.query(`CREATE DATABASE "${dbName}"`);

  // 2. Connect to the NEW database and run all org migrations as one
  // transaction. Postgres DDL is transactional, so this genuinely rolls
  // back cleanly on any failure -- unlike some other databases.
  const orgPool = new Pool({ connectionString: buildConnectionStringForDb(dbName), max: 5 });
  try {
    const client = await orgPool.connect();
    try {
      await client.query("BEGIN");
      for (const file of ORG_MIGRATION_FILES) {
        const fullPath = path.join(migrationsDir(), file);
        let sql = fs.readFileSync(fullPath, "utf8"); // throws loudly if path is wrong -- do not swallow
        if (sql.charCodeAt(0) === 0xFEFF) sql = sql.slice(1); // strip UTF-8 BOM if present (004_*.sql has one)
        await client.query(sql);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    // Migrations failed -- do not leave a half-built client database behind.
    await orgPool.end();
    await controlPool.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    throw err;
  }
  await orgPool.end();

  // 3. Register the org in the shared control-plane table, only now that
  // its database is fully migrated and known-good.
  const { rows } = await controlPool.query<{ id: string }>(
    `INSERT INTO organizations (name, db_name) VALUES ($1, $2) RETURNING id`,
    [orgName, dbName],
  );

  return { organizationId: rows[0].id, name: orgName, dbName };
}


