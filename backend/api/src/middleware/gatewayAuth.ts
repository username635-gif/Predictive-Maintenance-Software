import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { getPgPoolOrThrow, getOrgPool } from '../db/pg';

declare global {
  namespace Express {
    interface Request {
      gatewayId?: string; // set by requireGatewayKey -- the authenticated gateway's own id (per-org gateways.id)
    }
  }
}

/**
 * Generates a new plaintext gateway API key. Returned to the caller exactly
 * once (at gateway-creation time) and never stored in plaintext anywhere --
 * only its hash (see hashGatewayKey) is persisted, in gateway_registry.
 */
export function generateGatewayKey(): string {
  return `rgw_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * One-way hash of a gateway key for storage/lookup in gateway_registry.key_hash.
 * sha256 is sufficient here (not a password -- high-entropy random token,
 * no need for bcrypt-style slow hashing / salting).
 */
export function hashGatewayKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Authenticates a field gateway via the X-Gateway-Key header (NOT a user
 * JWT -- gateways have no user/org login). Looks up the key's hash in the
 * control-plane gateway_registry table, resolves the owning org's pool,
 * and attaches it to req.orgPool (same shape requireAuth uses) plus
 * req.gatewayId, so downstream handlers (sensorsBulk.ts) don't need to
 * know the difference between a gateway-authenticated request and a
 * user-authenticated one.
 */
export async function requireGatewayKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = req.headers['x-gateway-key'];
  if (typeof key !== 'string' || key.length === 0) {
    res.status(401).json({ error: 'Missing X-Gateway-Key header' });
    return;
  }

  const keyHash = hashGatewayKey(key);

  try {
    const control = getPgPoolOrThrow();
    const { rows } = await control.query<{ organization_id: string; gateway_id: string }>(
      `SELECT organization_id, gateway_id FROM gateway_registry WHERE key_hash = $1`,
      [keyHash],
    );

    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid gateway key' });
      return;
    }

    const { organization_id: organizationId, gateway_id: gatewayId } = rows[0];

    req.orgPool = await getOrgPool(organizationId);
    req.gatewayId = gatewayId;

    // Best-effort, non-blocking -- a failure here shouldn't reject a
    // legitimate, authenticated ingestion request.
    control.query(`UPDATE gateway_registry SET last_used_at = now() WHERE key_hash = $1`, [keyHash]).catch((e) => {
      console.error('[gatewayAuth] failed to update last_used_at', e);
    });

    next();
  } catch (e) {
    console.error('[gatewayAuth] DB error', e);
    res.status(500).json({ error: 'Failed to authenticate gateway' });
  }
}
