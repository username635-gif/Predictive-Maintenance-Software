import { NextFunction, Request, Response } from 'express';
import { Pool } from 'pg';

// Minimal typings for environments without @types/node.
// This project already has @types/node in devDependencies, but we avoid hard dependency at compile time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

export type AuditActionType =
  | 'alert_ack'
  | 'workorder_create'
  | 'workorder_update'
  | 'escalate'
  | 'sim_toggle';

// Headers are reserved for future generic usage.
const DEFAULT_ACTION_HEADER = 'x-action-type';
const DEFAULT_ENTITY_TYPE_HEADER = 'x-entity-type';
const DEFAULT_ENTITY_ID_HEADER = 'x-entity-id';

const DEFAULT_ACTOR_ID_HEADER = 'x-actor-id';
const DEFAULT_ACTOR_NAME_HEADER = 'x-actor-name';

function getClientIp(req: Request): string | null {
  // Prefer explicit forwarded header set by reverse proxies.
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    // Can be a comma-separated list; take left-most.
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) return xff[0];
  // Express's req.ip may include port or be ::ffff.
  if (typeof req.ip === 'string' && req.ip.length > 0) return req.ip;
  return null;
}

function getHeader(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  if (typeof v === 'string') return v;
  return undefined;
}

function jsonOrUndefined(v: unknown): Record<string, unknown> | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') {
    // Allow passing pre-stringified JSON.
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  if (typeof v === 'object') return v as Record<string, unknown>;
  return undefined;
}

function createPgPoolFromEnv(): Pool | null {
  const { DATABASE_URL, PGHOST, PGUSER, PGPASSWORD, PGPORT, PGDATABASE } = process.env;

  // Require at least one configuration method.
  if (!DATABASE_URL && !(PGHOST && PGUSER && PGDATABASE)) return null;

  const pool = new Pool({
    connectionString: DATABASE_URL,
    host: DATABASE_URL ? undefined : PGHOST,
    user: DATABASE_URL ? undefined : PGUSER,
    password: DATABASE_URL ? undefined : PGPASSWORD,
    port: DATABASE_URL ? undefined : (PGPORT ? Number(PGPORT) : undefined),
    database: DATABASE_URL ? undefined : PGDATABASE,
    // Small defaults: this API is small; prevent connection storms.
    max: 5,
  });

  return pool;
}

export function auditLog(mutations: {
  actionType: AuditActionType;
  entityType: string;
  entityId: (req: Request) => string;
  // Optional hooks to capture state. If not provided, previous_state is null and new_state comes from req.body.
  previousState?: (req: Request) => unknown;
  newState?: (req: Request, result: unknown) => unknown;
}) {
  const pool = createPgPoolFromEnv();

  return function auditMiddleware(req: Request, res: Response, next: NextFunction) {
    // Fail closed if actor_id is missing.
    const actorId = getHeader(req, DEFAULT_ACTOR_ID_HEADER);
    const actorName = getHeader(req, DEFAULT_ACTOR_NAME_HEADER) ?? null;

    if (!actorId) {
      res.status(400).json({ error: 'Missing x-actor-id (required for audit logging)' });
      return;
    }

    const entityId = mutations.entityId(req);

    // Capture a mutable response payload by overriding res.json.
    const originalJson = res.json.bind(res);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).json = async (body: any) => {
      try {
        // Compute audit record
        const ipAddress = getClientIp(req);
        const previousState = mutations.previousState?.(req) ?? null;

        // Use caller-provided newState hook, otherwise attempt req.body or response body.
        const auditNewState =
          mutations.newState?.(req, body?.work_order ?? body?.alert ?? body) ??
          jsonOrUndefined(req.body) ??
          jsonOrUndefined(body);

        if (!auditNewState) {
          // new_state is NOT NULL in SQL; ensure we always have something.
          // If we can't extract it, reject.
          throw new Error('Unable to derive new_state for audit_log (new_state is required)');
        }

        if (!pool) {
          // Fail closed: cannot write audit.
          throw new Error('Audit DB not configured (no DATABASE_URL / PG connection params)');
        }

        const insert = `
          INSERT INTO audit_log (timestamp, actor_id, actor_name, action_type, entity_id, entity_type, previous_state, new_state, ip_address)
          VALUES (now(), $1, $2, $3::audit_action_type, $4, $5, $6::jsonb, $7::jsonb, $8::inet)
        `;

        await pool.query(insert, [
          actorId,
          actorName,
          mutations.actionType,
          entityId,
          mutations.entityType,
          previousState,
          auditNewState,
          ipAddress ?? null,
        ]);

        return originalJson(body);
      } catch (err) {
        // Fail closed: do not return success if audit insert failed.
        const message = err instanceof Error ? err.message : 'Audit write failed';
        res.status(500).json({ error: 'Audit write failed', details: message });
        return;
      }
    };

    next();
  };
}

