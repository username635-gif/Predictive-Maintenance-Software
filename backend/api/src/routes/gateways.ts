import { Router, Request, Response } from 'express';
import type { GatewayConfig, GatewaySourceType } from '../types/gatewayConfig';
import type { ProtocolGatewayStatusRow } from '../types/gatewayStatus';
import { generateGatewayKey, hashGatewayKey } from '../middleware/gatewayAuth';
import { getPgPoolOrThrow } from '../db/pg';

const router = Router();

type Protocol = 'MQTT' | 'OPC-UA' | 'Modbus TCP' | 'REST API';

const PROTOCOL_THRESHOLDS_MINUTES: Partial<Record<Protocol, number>> = {
  MQTT: 5,
  'OPC-UA': 5,
  'Modbus TCP': 15,
};

function normalizeGatewayConfig(raw: any): GatewayConfig {
  // Map DB shape -> existing API response shape.
  // segment_id is stored; API expects segment_assignment string.
  const segment_assignment = typeof raw.segment_assignment === 'string'
    ? raw.segment_assignment
    : typeof raw.segment_id === 'string'
      ? raw.segment_id
      : '';

  return {
    id: String(raw.id),
    name: String(raw.name ?? raw.id),
    protocol: raw.protocol,
    source: raw.source_type ?? raw.source,
    segment_assignment,
    last_seen_at: raw.last_seen_at ? new Date(raw.last_seen_at).toISOString() : null,
    status: raw.status,
  };
}

router.get('/status', async (req: Request, res: Response) => {
  const pool = req.orgPool!;

  // Expected DB protocol values.
  const PROTOCOLS: Protocol[] = ['MQTT', 'OPC-UA', 'Modbus TCP', 'REST API'];

  try {
    // Pull gateway configs and last successful heartbeat per protocol.
    // We compute per-protocol:
    // - counts by source_type
    // - latest successful heartbeat timestamp
    // - error_count_24h = count of failed heartbeats in last 24h for gateways of that protocol

    const protocols: Protocol[] = ['MQTT', 'OPC-UA', 'Modbus TCP', 'REST API'];
    const perProtocol: Record<Protocol, { lastSeen: string | null; device_counts: Record<GatewaySourceType, number>; error_count_24h: number }> = {
      MQTT: { lastSeen: null, device_counts: { real: 0, simulator: 0 }, error_count_24h: 0 },
      'OPC-UA': { lastSeen: null, device_counts: { real: 0, simulator: 0 }, error_count_24h: 0 },
      'Modbus TCP': { lastSeen: null, device_counts: { real: 0, simulator: 0 }, error_count_24h: 0 },
      'REST API': { lastSeen: null, device_counts: { real: 0, simulator: 0 }, error_count_24h: 0 },
    };

    // Device counts from gateways.
    const { rows: gatewayRows } = await pool.query(
      `SELECT id, protocol, source_type
       FROM gateways
       WHERE protocol = ANY($1::text[])`,
      [protocols],
    );

    for (const gw of gatewayRows) {
      const protocol = gw.protocol as Protocol;
      const sourceType: GatewaySourceType = gw.source_type === 'simulator' ? 'simulator' : 'real';

      // Graceful degradation: ignore unknown/unsupported protocols so this endpoint doesn't 500.
      if (!perProtocol[protocol]) continue;
      perProtocol[protocol].device_counts[sourceType] += 1;
    }


    // Latest successful heartbeat by protocol.
    const { rows: lastSuccessRows } = await pool.query(
      `WITH last_success AS (
         SELECT g.protocol,
                MAX(h.timestamp) AS last_success_at
         FROM gateways g
         JOIN gateway_heartbeats h ON h.gateway_id = g.id
         WHERE h.success = TRUE
         GROUP BY g.protocol
       )
       SELECT protocol, last_success_at
       FROM last_success`,
    );

    for (const r of lastSuccessRows) {
      const protocol = r.protocol as Protocol;
      if (perProtocol[protocol]) {
        perProtocol[protocol].lastSeen = r.last_success_at ? new Date(r.last_success_at).toISOString() : null;
      }
    }

    // Error counts in last 24 hours by protocol.
    const { rows: errorRows } = await pool.query(
      `SELECT g.protocol, COUNT(*)::int AS error_count_24h
       FROM gateways g
       JOIN gateway_heartbeats h ON h.gateway_id = g.id
       WHERE h.success = FALSE
         AND h.timestamp >= NOW() - INTERVAL '24 hours'
       GROUP BY g.protocol`,
    );

    for (const r of errorRows) {
      const protocol = r.protocol as Protocol;
      if (perProtocol[protocol]) {
        perProtocol[protocol].error_count_24h = Number(r.error_count_24h ?? 0);
      }
    }

    const now = Date.now();
    const result: ProtocolGatewayStatusRow[] = protocols.map((protocol) => {
      const last_success_at = perProtocol[protocol].lastSeen;
      const thresholdMin = PROTOCOL_THRESHOLDS_MINUTES[protocol] ?? 5;

      const lastSuccessMs = last_success_at ? Date.parse(last_success_at) : null;
      const hasRecentData = lastSuccessMs !== null && now - lastSuccessMs <= thresholdMin * 60_000;

      let status_label: string;
      let status_dot_color: string;

      if (!last_success_at) {
        status_label = 'Never connected';
        status_dot_color = '#9BA3B2';
      } else if (!hasRecentData) {
        status_label = 'No recent data';
        status_dot_color = '#FFB020';
      } else {
        status_label = 'Active';
        status_dot_color = '#5ABFA5';
      }

      const error_count_24h = perProtocol[protocol].error_count_24h;

      return {
        protocol: protocol as any,
        status_dot_color,
        status_label,
        last_success_at,
        device_counts: perProtocol[protocol].device_counts,
        total_devices: perProtocol[protocol].device_counts.real + perProtocol[protocol].device_counts.simulator,
        error_count_24h,
        error_log_filter_url: error_count_24h > 0 ? `/api/v1/audit?protocol=${encodeURIComponent(protocol)}` : undefined,
      };
    });

    res.json({ protocols: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[gateways/status] DB error', e);
    res.status(500).json({ error: 'Failed to fetch gateway status', details: message });
  }
});

// ───────────────────────────── Registered Gateways (List + Edit) ─────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = req.orgPool!;
    const { rows } = await pool.query(
      `SELECT id, name, protocol, source_type, segment_id, last_seen_at, status
       FROM gateways
       ORDER BY created_at DESC`
    );

    res.json({ gateways: rows.map(normalizeGatewayConfig) });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[gateways:list] DB error', e);
    res.status(500).json({ error: 'Failed to fetch gateways', details: message });
  }
});

router.get('/:gatewayId', async (req: Request, res: Response) => {
  const gatewayId = String(req.params.gatewayId);
  try {
    const pool = req.orgPool!;
    const { rows } = await pool.query(
      `SELECT id, name, protocol, source_type, segment_id, last_seen_at, status
       FROM gateways
       WHERE id = $1`,
      [gatewayId]
    );

    const gw = rows[0];
    if (!gw) {
      res.status(404).json({ error: `Gateway not found: ${gatewayId}` });
      return;
    }

    res.json({ gateway: normalizeGatewayConfig(gw) });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[gateways:get] DB error', e);
    res.status(500).json({ error: 'Failed to fetch gateway', details: message });
  }
});

// ───────────────────────────── Register New Gateway (Create) ─────────────────────────────
// On success this also provisions a gateway API key: generates a plaintext
// key, stores only its hash (control-plane gateway_registry), and returns
// the plaintext exactly once in this response. It is never persisted
// anywhere in plaintext and cannot be recovered later -- only reissued
// (not yet built: a reissue endpoint would need to invalidate the old
// registry row, since key_hash is the primary key).
router.post('/', async (req: Request, res: Response) => {
  const payload = req.body ?? {};

  try {
    const pool = req.orgPool!;
    const organizationId = req.user!.organizationId;

    const PROTOCOLS: Protocol[] = ['MQTT', 'OPC-UA', 'Modbus TCP', 'REST API'];
    const isProtocol = (v: unknown): v is Protocol => typeof v === 'string' && PROTOCOLS.includes(v as Protocol);

    const name = typeof payload?.name === 'string' ? payload.name : null;
    const nextProtocolRaw = typeof payload?.protocol === 'string' ? payload.protocol : null;
    const sourceType = typeof payload?.source_type === 'string' ? payload.source_type : null;
    const segmentId = typeof payload?.segment_assignment === 'string' ? payload.segment_assignment : null;

    // Validate required fields.
    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: name' });
      return;
    }

    if (nextProtocolRaw === null || !isProtocol(nextProtocolRaw)) {
      res.status(400).json({
        error: 'Invalid protocol',
        details: `protocol must be one of: ${PROTOCOLS.join(', ')}`,
      });
      return;
    }

    if (sourceType !== 'real' && sourceType !== 'simulator') {
      res.status(400).json({ error: 'Invalid source_type', details: "source_type must be one of: real, simulator" });
      return;
    }

    if (!segmentId || segmentId.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: segment_assignment' });
      return;
    }

    // If table already exists without the UUID default, DB will still accept explicit UUID;
    // however we rely on the UUID default for id generation if present.
    // Prefer DB-side id generation: use DEFAULT for id.
    const initialStatus = typeof payload?.status === 'string' ? payload.status : 'unknown';

    const { rows } = await pool.query(
      `INSERT INTO gateways (id, name, protocol, source_type, segment_id, status)
       VALUES (DEFAULT, $1, $2, $3, $4, $5)
       RETURNING id, name, protocol, source_type, segment_id, last_seen_at, status`,
      [name.trim(), nextProtocolRaw, sourceType, segmentId.trim(), initialStatus]
    );

    const created = rows[0];

    // Provision the gateway API key. This write is in a SEPARATE database
    // (control-plane) from the insert above (org DB) -- Postgres cannot
    // transaction across two connections, so this is not atomic with the
    // insert above. If it fails, we compensate by deleting the just-created
    // gateway row rather than leaving an unusable, keyless gateway behind.
    const plaintextKey = generateGatewayKey();
    const keyHash = hashGatewayKey(plaintextKey);

    try {
      const control = getPgPoolOrThrow();
      await control.query(
        `INSERT INTO gateway_registry (key_hash, organization_id, gateway_id) VALUES ($1, $2, $3)`,
        [keyHash, organizationId, created.id]
      );
    } catch (registryErr) {
      console.error('[gateways:post] gateway_registry insert failed, rolling back gateway row', registryErr);
      try {
        await pool.query(`DELETE FROM gateways WHERE id = $1`, [created.id]);
      } catch (cleanupErr) {
        console.error('[gateways:post] CRITICAL: compensating cleanup also failed -- orphaned gateway row', created.id, cleanupErr);
      }
      res.status(500).json({ error: 'Failed to provision gateway key; gateway was not created' });
      return;
    }

    res.status(201).json({
      gateway: normalizeGatewayConfig(created),
      gateway_key: plaintextKey,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[gateways:post] DB error', e);
    res.status(500).json({ error: 'Failed to create gateway', details: message });
  }
});


router.put('/:gatewayId', async (req: Request, res: Response) => {
  const gatewayId = String(req.params.gatewayId);
  const payload = req.body ?? {};

  try {
    const pool = req.orgPool!;

    const PROTOCOLS: Protocol[] = ['MQTT', 'OPC-UA', 'Modbus TCP', 'REST API'];
    const isProtocol = (v: unknown): v is Protocol => typeof v === 'string' && PROTOCOLS.includes(v as Protocol);

    // Payload is expected to match GatewayConfig fields.
    // Map segment_assignment -> segment_id (best-effort).
    const nextName = typeof payload?.name === 'string' ? payload.name : null;
    const nextProtocolRaw = typeof payload?.protocol === 'string' ? payload.protocol : null;
    if (nextProtocolRaw !== null && !isProtocol(nextProtocolRaw)) {
      res.status(400).json({
        error: 'Invalid protocol',
        details: `protocol must be one of: ${PROTOCOLS.join(', ')}`,
      });
      return;
    }
    const nextProtocol = nextProtocolRaw as Protocol | null;
    const nextSource = typeof payload?.source === 'string' ? payload.source : null;
    
    if (nextSource !== null && nextSource !== 'real' && nextSource !== 'simulator') {
      res.status(400).json({
        error: 'Invalid source_type',
        details: "source_type must be one of: real, simulator",
      });
      return;
    }

    const nextSegmentId = typeof payload?.segment_assignment === 'string' ? payload.segment_assignment : null;
    const nextStatus = typeof payload?.status === 'string' ? payload.status : null;

    const { rows } = await pool.query(
      `UPDATE gateways
       SET
         name = COALESCE($2, name),
         protocol = COALESCE($3, protocol),
         source_type = COALESCE($4, source_type),
         segment_id = COALESCE($5, segment_id),
         status = COALESCE($6, status)
       WHERE id = $1
       RETURNING id, name, protocol, source_type, segment_id, last_seen_at, status`,
      [gatewayId, nextName, nextProtocol, nextSource, nextSegmentId, nextStatus]
    );


    const updated = rows[0];
    if (!updated) {
      res.status(404).json({ error: `Gateway not found: ${gatewayId}` });
      return;
    }

    res.json({ gateway: normalizeGatewayConfig(updated) });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[gateways:put] DB error', e);
    res.status(500).json({ error: 'Failed to update gateway', details: message });
  }
});

export default router;
