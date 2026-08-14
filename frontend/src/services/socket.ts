import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../auth/rosSession';
import { apiBaseUrl } from '../utils/apiBase';

/**
 * Socket.IO client for ReliabilityOS.
 *
 * Every event name and payload shape below was verified against a live
 * backend (backend/api/src/server.ts) on 2026-08-13 by connecting a probe
 * client and dumping the real packets. The backend emits raw Postgres rows
 * with no serialization layer, so these interfaces mirror the actual DB
 * columns as returned by node-postgres.
 *
 * Server -> client events (all of them, there are exactly five):
 *   state:init             once per connection, right after handshake
 *   alerts:active          broadcast to everyone every 5 seconds
 *   workorder:created      broadcast after a socket workorder:create succeeds
 *   workorder:create:error sent only to the requesting socket on failure
 *   alert:acknowledged     broadcast after a socket alert:acknowledge succeeds
 *
 * Client -> server events:
 *   workorder:create       payload object, inserted into work_orders
 *   alert:acknowledge      payload is a bare alert id string, NOT an object
 */

/**
 * node-postgres returns NUMERIC/DECIMAL columns as strings, not numbers, and
 * this backend installs no pg type parser. Verified live: cost_avoided_estimate
 * and estimated_downtime_hours both arrive as strings. Anything typed PgNumeric
 * must be coerced with Number() before arithmetic or formatting.
 */
export type PgNumeric = string | number | null;

/** Row from `SELECT * FROM assets`. 14 columns, verified live. */
export interface SocketAssetRow {
  id: string;
  name: string;
  platform: string;
  line: string | null;
  zone: string | null;
  latitude: PgNumeric;
  longitude: PgNumeric;
  replacement_cost: PgNumeric;
  downtime_cost_per_hour: PgNumeric;
  priority: 'low' | 'medium' | 'high' | 'critical' | 'unset';
  is_low_priority: boolean;
  created_at: string;
  updated_at: string;
  route: { lat: number; lng: number }[] | null;
  /**
   * NOT SENT over the socket. health_score / health_score_open_alerts are
   * computed in routes/assets.ts and exist only on the REST response; the
   * socket does a bare SELECT * so they are always absent here. Do not
   * overwrite REST-loaded assets wholesale with socket assets or you will
   * blank the health scores.
   */
  health_score?: never;
  health_score_open_alerts?: never;
}

/** Row from `SELECT * FROM sensors`. 11 columns, verified live. */
export interface SocketSensorRow {
  id: string;
  asset_id: string;
  sensor_type: string;
  unit: string;
  baseline_value: PgNumeric;
  baseline_updated_at: string | null;
  hard_min: PgNumeric;
  hard_max: PgNumeric;
  manual_override_min: PgNumeric;
  manual_override_max: PgNumeric;
  created_at: string;
  /**
   * NOT SENT over the socket. status / last_value / last_seen are derived in
   * routes/sensors.ts from live readings and are not columns on the sensors
   * table. Same warning as above: socket sensors are strictly poorer than
   * REST sensors.
   */
  status?: never;
  last_value?: never;
  last_seen?: never;
}

/**
 * Row from the alerts table.
 *
 * asset_name is present on state:init and alerts:active (both JOIN assets)
 * but ABSENT on alert:acknowledged, which returns the bare UPDATE ... RETURNING *
 * row with no join. Verified live, hence optional.
 */
export interface SocketAlertRow {
  id: string;
  asset_id: string;
  prediction_id: string | null;
  root_cause_signature: string;
  source: 'rule' | 'ml';
  tier: 'red' | 'yellow' | 'green';
  trigger_summary: string;
  recommended_action: string;
  confidence: PgNumeric;
  status: 'open' | 'acknowledged' | 'escalated' | 'resolved';
  dwell_start_at: string | null;
  ignored_count: number;
  escalated_to: string | null;
  cost_avoided_estimate: PgNumeric;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  asset_name?: string;
}

/**
 * Row from `SELECT * FROM predictions`. Column list taken from the live
 * database schema; the live probe saw an empty predictions array because the
 * table has zero rows, so the per-field JSON types are inferred from column
 * types rather than observed.
 */
export interface SocketPredictionRow {
  id: string;
  segment_id: string;
  created_at: string;
  anomaly_score: PgNumeric;
  rul_days: number | null;
  rul_lower: number | null;
  rul_upper: number | null;
  failure_mode: string | null;
  severity: string | null;
  model_version: string | null;
  raw_output: unknown;
}

/** Row from work_orders. 17 columns, verified live. */
export interface SocketWorkOrderRow {
  id: string;
  title: string;
  segment_id: string;
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string | null;
  repair_procedure: string | null;
  estimated_downtime_hours: PgNumeric;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  completed_at: string | null;
  prediction_id: string | null;
  technician_notes: string | null;
  actual_root_cause: string | null;
  alert_id: string | null;
}

/**
 * state:init payload. On the happy path error is absent. On a DB failure the
 * backend still emits state:init but with all four arrays empty and
 * error: 'Failed to load initial state' — so an empty payload must NOT be
 * treated as "there is genuinely no data".
 */
export interface StateInitPayload {
  assets: SocketAssetRow[];
  sensors: SocketSensorRow[];
  alerts: SocketAlertRow[];
  predictions: SocketPredictionRow[];
  error?: string;
}

/** workorder:create:error payload. */
export interface WorkOrderCreateErrorPayload {
  message: string;
}

/** Payload accepted by the client -> server workorder:create event. */
export interface WorkOrderCreateRequest {
  title?: string;
  segment_id?: string;
  asset_id?: string;
  description?: string | null;
  repair_procedure?: string | null;
  estimated_downtime_hours?: number;
  assigned_to?: string;
  due_date?: string | null;
  prediction_id?: string | null;
}

export interface SocketHandlers {
  onStateInit?: (payload: StateInitPayload) => void;
  onActiveAlerts?: (alerts: SocketAlertRow[]) => void;
  onWorkOrderCreated?: (workOrder: SocketWorkOrderRow) => void;
  onWorkOrderCreateError?: (payload: WorkOrderCreateErrorPayload) => void;
  onAlertAcknowledged?: (alert: SocketAlertRow) => void;
  onConnectError?: (message: string) => void;
  /** Debug firehose. Fires for every event, including ones added later. */
  onAny?: (event: string, payload: unknown) => void;
}

let socket: Socket | null = null;

/**
 * The backend registers its workorder:create and alert:acknowledge listeners
 * only AFTER awaiting the state:init queries inside io.on('connection'). Any
 * write emitted before that await resolves is silently dropped — verified
 * live: emitting on connect produced no response and no server-side log,
 * while the identical emit 3s later succeeded.
 *
 * state:init is emitted in the same synchronous tick as those registrations,
 * so its arrival is a safe readiness signal. Writes are queued until then.
 */
let serverReady = false;
let pendingWrites: Array<() => void> = [];

function sendOrQueue(send: () => void): void {
  if (serverReady) send();
  else pendingWrites.push(send);
}

function flushPendingWrites(): void {
  serverReady = true;
  const queued = pendingWrites;
  pendingWrites = [];
  queued.forEach((send) => send());
}

export function connectSocket(handlers: SocketHandlers = {}): Socket | null {
  const token = getAuthToken();
  if (!token) return null;
  if (socket?.connected) return socket;

  serverReady = false;
  pendingWrites = [];

  socket = io(apiBaseUrl(), {
    auth: { token },
    transports: ['websocket'],
  });

  if (handlers.onAny) {
    socket.onAny((event, payload) => handlers.onAny?.(event, payload));
  }

  socket.on('state:init', (payload: StateInitPayload) => {
    if (payload?.error) {
      console.error('[socket] state:init reported a server error:', payload.error);
    }
    flushPendingWrites();
    handlers.onStateInit?.(payload);
  });

  socket.on('alerts:active', (alerts: SocketAlertRow[]) => {
    handlers.onActiveAlerts?.(Array.isArray(alerts) ? alerts : []);
  });

  socket.on('workorder:created', (workOrder: SocketWorkOrderRow) => {
    handlers.onWorkOrderCreated?.(workOrder);
  });

  socket.on('workorder:create:error', (payload: WorkOrderCreateErrorPayload) => {
    console.error('[socket] workorder:create failed:', payload?.message);
    handlers.onWorkOrderCreateError?.(payload);
  });

  socket.on('alert:acknowledged', (alert: SocketAlertRow) => {
    handlers.onAlertAcknowledged?.(alert);
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] connection error:', err.message);
    handlers.onConnectError?.(err.message);
  });

  socket.on('disconnect', () => {
    serverReady = false;
  });

  return socket;
}

/**
 * Requests a work order over the socket. The result comes back asynchronously
 * as workorder:created (broadcast to all clients) or workorder:create:error.
 *
 * Note the store currently creates work orders over REST instead; using both
 * paths at once would double-insert.
 */
export function emitCreateWorkOrder(payload: WorkOrderCreateRequest): void {
  if (!socket) return;
  sendOrQueue(() => socket?.emit('workorder:create', payload));
}

/**
 * Acknowledges an alert over the socket. The backend expects a bare id string.
 * It emits alert:acknowledged only if a row actually changed — an already
 * acknowledged or resolved alert produces no response event at all.
 */
export function emitAcknowledgeAlert(alertId: string): void {
  if (!socket) return;
  sendOrQueue(() => socket?.emit('alert:acknowledge', alertId));
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  serverReady = false;
  pendingWrites = [];
}
