import { Pool } from 'pg';

let pool: Pool | null = null;

function createPoolFromEnv(): Pool {
  const { DATABASE_URL, PGHOST, PGUSER, PGPASSWORD, PGPORT, PGDATABASE } = process.env;

  if (!DATABASE_URL && !(PGHOST && PGUSER && PGDATABASE)) {
    throw new Error('Postgres DB not configured (DATABASE_URL or PG* required)');
  }

  return new Pool({
    connectionString: DATABASE_URL,
    host: DATABASE_URL ? undefined : PGHOST,
    user: DATABASE_URL ? undefined : PGUSER,
    password: DATABASE_URL ? undefined : PGPASSWORD,
    port: DATABASE_URL ? undefined : (PGPORT ? Number(PGPORT) : undefined),
    database: DATABASE_URL ? undefined : PGDATABASE,
    // Connection pooling defaults kept small.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

/**
 * Returns a shared pg Pool.
 * - Fails loudly on startup if DATABASE_URL (or PG*) is missing or connect fails.
 * - Uses parameterized queries only.
 */
export async function getPgPool(): Promise<Pool> {
  if (pool) return pool;

  pool = createPoolFromEnv();

  // Fail on startup if DB is unreachable.
  await pool.query('SELECT 1');
  return pool;
}

/**
 * Used to ensure startup fails before server begins accepting traffic.
 */


export function getPgPoolOrThrow(): Pool {
  if (!pool) throw new Error('Postgres pool not initialized');
  return pool;
}

