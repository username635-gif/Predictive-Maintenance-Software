import { NextFunction, Request, Response } from 'express';
import { Pool } from 'pg';

declare const process: any;

export type AuditActionType =
  | 'alert_ack'
  | 'workorder_create'
  | 'workorder_update'
  | 'escalate'
  | 'sim_toggle'
  | 'gateway_register';

function getClientIp(req: Request): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) return xff[0];
  if (typeof req.ip === 'string' && req.ip.length > 0) return req.ip;
  return null;
}

function jsonOrUndefined(v: unknown): Record<string, unknown> | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') {
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
  if (!DATABASE_URL && !(PGHOST && PGUSER && PGDATABASE)) return null;

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

export function auditLog(mutations: {
  actionType: AuditActionType;
  entityType: string;
  entityId: (req: Request) => string;
  previousState?: (req: Request) => unknown | Promise<unknown>;
  newState?: (req: Request, result: unknown) => unknown | Promise<unknown>;
}) {
  const pool = createPgPoolFromEnv();

  return function auditMiddleware(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
      res.status(401).json({ error: 'Audit logging requires an authenticated request (requireAuth must run first)' });
      return;
    }
    const actorId = req.user.id;
    const actorName = req.user.name;

    const entityId = mutations.entityId(req);
    const originalJson = res.json.bind(res);

    (res as any).json = async (body: any) => {
      try {
        const ipAddress = getClientIp(req);
        const previousState = mutations.previousState ? await mutations.previousState(req) : null;

        const newStateCandidate = mutations.newState
          ? await mutations.newState(req, body?.work_order ?? body?.alert ?? body)
          : undefined;

        const auditNewState = newStateCandidate ?? jsonOrUndefined(req.body) ?? jsonOrUndefined(body);

        if (!auditNewState) {
          throw new Error('Unable to derive new_state for audit_log (new_state is required)');
        }
        if (!pool) {
          throw new Error('Audit DB not configured (no DATABASE_URL / PG connection params)');
        }

        const insert = `
          INSERT INTO audit_log (timestamp, actor_id, actor_name, action_type, entity_id, entity_type, previous_state, new_state, ip_address)
          VALUES (now(), $1, $2, $3::audit_action_type, $4, $5, $6::jsonb, $7::jsonb, $8::inet)
        `;

        await pool.query(insert, [
          actorId, actorName, mutations.actionType, entityId, mutations.entityType,
          previousState, auditNewState, ipAddress ?? null,
        ]);

        return originalJson(body);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Audit write failed';
        res.status(500).json({ error: 'Audit write failed', details: message });
        return;
      }
    };

    next();
  };
}