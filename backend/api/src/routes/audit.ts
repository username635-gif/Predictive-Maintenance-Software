import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

const router = Router();

function createPgPoolFromEnv(): Pool {

  const { DATABASE_URL, PGHOST, PGUSER, PGPASSWORD, PGPORT, PGDATABASE } = process.env;

  if (!DATABASE_URL && !(PGHOST && PGUSER && PGDATABASE)) {
    throw new Error('Audit DB not configured (DATABASE_URL or PG* required)');
  }

  return new Pool({
    connectionString: DATABASE_URL,
    host: DATABASE_URL ? undefined : PGHOST,
    user: DATABASE_URL ? undefined : PGUSER,
    password: DATABASE_URL ? undefined : PGPASSWORD,
    port: DATABASE_URL ? undefined : (PGPORT ? Number(PGPORT) : undefined),
    database: DATABASE_URL ? undefined : PGDATABASE,
    max: 5,
  });
}

router.get('/', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 25), 100);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);

  const entityId = typeof req.query.entity_id === 'string' ? req.query.entity_id : undefined;
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;

  let pool: Pool;
  try {
    pool = createPgPoolFromEnv();
  } catch (_e) {

    res.status(500).json({ error: 'Audit DB not configured' });
    return;
  }

  // Build query with optional filters.
  const where: string[] = [];
  const values: unknown[] = [];

  let i = 1;
  if (entityId) {
    where.push(`entity_id = $${i++}`);
    values.push(entityId);
  }
  if (from) {
    where.push(`timestamp >= $${i++}`);
    values.push(from);
  }
  if (to) {
    where.push(`timestamp <= $${i++}`);
    values.push(to);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const dataSql = `
    SELECT id, timestamp, actor_id, actor_name, action_type, entity_id, entity_type, previous_state, new_state, ip_address
    FROM audit_log
    ${whereSql}
    ORDER BY timestamp DESC
    LIMIT $${i++}
    OFFSET $${i++}
  `;
  values.push(limit, offset);

  const countSql = `
    SELECT COUNT(*)::int AS count
    FROM audit_log
    ${whereSql}
  `;

  try {
    const [{ rows: data }, { rows: countRows }] = await Promise.all([
      pool.query(dataSql, values),
      pool.query(countSql, values.slice(0, values.length - 2)),
    ]);

    res.json({
      count: countRows?.[0]?.count ?? 0,
      limit,
      offset,
      audit: data,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to fetch audit', details: message });
  }
});

export default router;

