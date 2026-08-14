import { create } from 'zustand';
import type {
  PipelineSegment, Sensor, PredictionResult, WorkOrder, Alert,
  PIGRun, ROIConfig, ROIMonthEntry, EdgeGatewayStatus,
  ViewMode, ActiveModal, ConnectivityStatus
} from '../types';
import type { GatewayConfig } from '../types/gateway';
import type {
  StateInitPayload, SocketAssetRow, SocketSensorRow, SocketAlertRow,
  SocketWorkOrderRow, SocketPredictionRow
} from '../services/socket';
import { format } from 'date-fns';
import { api, ApiError } from '../services/api';

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function adaptAsset(raw: any): PipelineSegment {
  return {
    id: raw.id,
    name: raw.name,
    platform: raw.platform,
    line: raw.line,
    zone: raw.zone,
    latitude: toNumberOrNull(raw.latitude),
    longitude: toNumberOrNull(raw.longitude),
    replacement_cost: toNumberOrNull(raw.replacement_cost),
    downtime_cost_per_hour: toNumberOrNull(raw.downtime_cost_per_hour),
    priority: raw.priority,
    is_low_priority: raw.is_low_priority,
    route: raw.route ?? null,
    health_score: toNumberOrNull(raw.health_score),
    health_score_open_alerts: raw.health_score_open_alerts ?? 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export function adaptAlert(raw: any): Alert {
  return {
    id: raw.id,
    asset_id: raw.asset_id,
    prediction_id: raw.prediction_id ?? null,
    root_cause_signature: raw.root_cause_signature,
    source: raw.source,
    tier: raw.tier,
    trigger_summary: raw.trigger_summary,
    recommended_action: raw.recommended_action,
    confidence: toNumberOrNull(raw.confidence),
    status: raw.status,
    dwell_start_at: raw.dwell_start_at ?? null,
    ignored_count: raw.ignored_count ?? 0,
    escalated_to: raw.escalated_to ?? null,
    cost_avoided_estimate: toNumberOrNull(raw.cost_avoided_estimate),
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    resolved_at: raw.resolved_at ?? null,
    asset_name: raw.asset_name,
    platform: raw.platform,
    line: raw.line,
    zone: raw.zone,
  };
}

export function adaptWorkOrder(raw: any): WorkOrder {
  return {
    id: raw.id,
    title: raw.title,
    segment_id: raw.segment_id,
    status: raw.status,
    priority: raw.priority,
    description: raw.description ?? null,
    repair_procedure: raw.repair_procedure ?? null,
    estimated_downtime_hours: toNumberOrNull(raw.estimated_downtime_hours) ?? 0,
    assigned_to: raw.assigned_to ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    due_date: raw.due_date ?? null,
    completed_at: raw.completed_at ?? null,
    prediction_id: raw.prediction_id ?? null,
    technician_notes: raw.technician_notes ?? null,
    actual_root_cause: raw.actual_root_cause ?? null,
    alert_id: raw.alert_id ?? null,
  };
}

export function adaptPrediction(raw: any): PredictionResult {
  return {
    id: raw.id,
    segment_id: raw.segment_id,
    created_at: raw.created_at,
    anomaly_score: toNumberOrNull(raw.anomaly_score),
    rul_days: raw.rul_days ?? null,
    rul_lower: raw.rul_lower ?? null,
    rul_upper: raw.rul_upper ?? null,
    failure_mode: raw.failure_mode ?? null,
    severity: raw.severity ?? null,
    model_version: raw.model_version ?? null,
    raw_output: raw.raw_output ?? null,
  };
}

export function adaptSensor(raw: any): Sensor {
  return {
    id: raw.id,
    asset_id: raw.asset_id,
    sensor_type: raw.sensor_type,
    unit: raw.unit,
    baseline_value: toNumberOrNull(raw.baseline_value),
    baseline_updated_at: raw.baseline_updated_at ?? null,
    hard_min: toNumberOrNull(raw.hard_min),
    hard_max: toNumberOrNull(raw.hard_max),
    manual_override_min: toNumberOrNull(raw.manual_override_min),
    manual_override_max: toNumberOrNull(raw.manual_override_max),
    created_at: raw.created_at,
    asset_name: raw.asset_name,
    platform: raw.platform,
    latitude: toNumberOrNull(raw.latitude) ?? undefined,
    longitude: toNumberOrNull(raw.longitude) ?? undefined,
    status: raw.status,
    last_value: toNumberOrNull(raw.last_value),
    last_seen: raw.last_seen ?? null,
  };
}

/**
 * Socket-sourced merge functions.
 *
 * The Socket.IO audit (2026-08-13) proved socket payloads are strictly
 * poorer than REST payloads: socket assets have no health_score /
 * health_score_open_alerts, socket sensors have no status / last_value /
 * last_seen (see services/socket.ts SocketAssetRow / SocketSensorRow
 * comments -- those fields are typed `never` there because they are never
 * actually sent). These merge functions take the real-time base fields from
 * the socket row but preserve those REST-only computed fields from whatever
 * is already in the store, instead of blanking them.
 */

function mergeAssetFromSocket(raw: SocketAssetRow, existing?: PipelineSegment): PipelineSegment {
  return {
    id: raw.id,
    name: raw.name,
    platform: raw.platform,
    line: raw.line,
    zone: raw.zone,
    latitude: toNumberOrNull(raw.latitude),
    longitude: toNumberOrNull(raw.longitude),
    replacement_cost: toNumberOrNull(raw.replacement_cost),
    downtime_cost_per_hour: toNumberOrNull(raw.downtime_cost_per_hour),
    priority: raw.priority,
    is_low_priority: raw.is_low_priority,
    route: raw.route ?? null,
    health_score: existing?.health_score ?? null,
    health_score_open_alerts: existing?.health_score_open_alerts ?? 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    mile_start: existing?.mile_start,
    mile_end: existing?.mile_end,
    coordinates: existing?.coordinates,
    health_status: existing?.health_status,
    sensors: existing?.sensors,
    last_pig_run: existing?.last_pig_run,
    next_pig_due: existing?.next_pig_due,
    material: existing?.material,
    diameter_inches: existing?.diameter_inches,
    wall_thickness_mm: existing?.wall_thickness_mm,
    operating_pressure_psi: existing?.operating_pressure_psi,
    max_pressure_psi: existing?.max_pressure_psi,
    installation_year: existing?.installation_year,
    coating_type: existing?.coating_type,
  };
}

function mergeSensorFromSocket(raw: SocketSensorRow, existing?: Sensor): Sensor {
  return {
    id: raw.id,
    asset_id: raw.asset_id,
    sensor_type: raw.sensor_type,
    unit: raw.unit,
    baseline_value: toNumberOrNull(raw.baseline_value),
    baseline_updated_at: raw.baseline_updated_at,
    hard_min: toNumberOrNull(raw.hard_min),
    hard_max: toNumberOrNull(raw.hard_max),
    manual_override_min: toNumberOrNull(raw.manual_override_min),
    manual_override_max: toNumberOrNull(raw.manual_override_max),
    created_at: raw.created_at,
    asset_name: existing?.asset_name,
    platform: existing?.platform,
    latitude: existing?.latitude,
    longitude: existing?.longitude,
    status: existing?.status ?? 'offline',
    last_value: existing?.last_value ?? null,
    last_seen: existing?.last_seen ?? null,
    name: existing?.name,
    type: existing?.type,
    protocol: existing?.protocol,
    segment_id: existing?.segment_id,
    mile_marker: existing?.mile_marker,
    lat: existing?.lat,
    lng: existing?.lng,
    last_reading: existing?.last_reading,
    history: existing?.history,
    battery: existing?.battery,
    normal_range: existing?.normal_range,
  };
}

function mergeAlertFromSocket(raw: SocketAlertRow, existing?: Alert): Alert {
  const adapted = adaptAlert(raw);
  return {
    ...adapted,
    asset_name: raw.asset_name ?? existing?.asset_name,
    platform: adapted.platform ?? existing?.platform,
    line: adapted.line ?? existing?.line,
    zone: adapted.zone ?? existing?.zone,
    type: existing?.type,
    segment_id: existing?.segment_id,
    timestamp: existing?.timestamp,
    severity: existing?.severity,
    message: existing?.message,
    location: existing?.location,
    acknowledged: existing?.acknowledged,
    triggering_sensors: existing?.triggering_sensors,
  };
}

function mergeWorkOrderFromSocket(raw: SocketWorkOrderRow, existing?: WorkOrder): WorkOrder {
  const adapted = adaptWorkOrder(raw);
  return {
    ...adapted,
    asset_id: existing?.asset_id,
    required_tools: existing?.required_tools,
    safety_notes: existing?.safety_notes,
    parts_list: existing?.parts_list,
    photos: existing?.photos,
    _queued: existing?._queued,
    _local_id: existing?._local_id,
  };
}

function mergePredictionFromSocket(raw: SocketPredictionRow, existing?: PredictionResult): PredictionResult {
  const adapted = adaptPrediction(raw);
  return {
    ...adapted,
    root_cause: existing?.root_cause,
    primary_failure_mode: existing?.primary_failure_mode,
    explanation: existing?.explanation,
    confidence: existing?.confidence,
    model_metadata: existing?.model_metadata,
  };
}

/** Upserts merged rows into an existing array by id. Never drops existing entries not present in `raw`. */
function mergeById<TRaw extends { id: string }, T extends { id: string }>(
  raw: TRaw[],
  existing: T[],
  mergeFn: (raw: TRaw, existing?: T) => T
): T[] {
  const map = new Map(existing.map(e => [e.id, e]));
  raw.forEach(r => map.set(r.id, mergeFn(r, map.get(r.id))));
  return Array.from(map.values());
}

interface AppState {
  segments: PipelineSegment[];
  sensors: Sensor[];
  predictions: PredictionResult[];
  workOrders: WorkOrder[];
  alerts: Alert[];
  pigRuns: PIGRun[];
  roiConfig: ROIConfig;
  roiHistory: ROIMonthEntry[];
  edgeGateways: EdgeGatewayStatus[];
  gatewayList: GatewayConfig[];

  dataLoading: boolean;
  dataError: string | null;

  selectedSegmentId: string | null;
  viewMode: ViewMode;
  activeModal: ActiveModal;
  drawerOpen: boolean;
  isOffline: boolean;
  isSimulatingOffline: boolean;
  connectivity: ConnectivityStatus;
  pendingSyncCount: number;
  simulatingLeak: boolean;

  selectSegment: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;
  toggleDrawer: () => void;
  setOffline: (offline: boolean) => void;
  toggleSimulateOffline: () => void;
  triggerLeakSimulation: () => void;
  dismissLeakSimulation: () => void;

  fetchGateways: () => Promise<void>;
  replaceGatewayList: (gateways: GatewayConfig[]) => void;
  upsertGateway: (gateway: GatewayConfig) => void;

  loadInitialData: () => Promise<void>;
  acknowledgeAlert: (id: string) => Promise<void>;
  createWorkOrder: (payload: Partial<WorkOrder> & { alert_id?: string }) => Promise<WorkOrder>;
  updateWorkOrder: (id: string, updates: Partial<WorkOrder>) => Promise<void>;
  queueOfflineWorkOrder: (wo: WorkOrder) => void;
  syncOfflineQueue: () => void;
  updateROIConfig: (config: Partial<ROIConfig>) => void;

  applyStateInit: (payload: StateInitPayload) => void;
  mergeActiveAlerts: (alerts: SocketAlertRow[]) => void;
  mergeWorkOrderCreated: (workOrder: SocketWorkOrderRow) => void;
  mergeAlertAcknowledged: (alert: SocketAlertRow) => void;

  getSegmentById: (id: string) => PipelineSegment | undefined;
  getPredictionForSegment: (segId: string) => PredictionResult | undefined;
  getSensorsForSegment: (segId: string) => Sensor[];
  getActiveAlerts: () => Alert[];
  getTotalROI: () => number;
}

export const useStore = create<AppState>((set, get) => ({
  segments: [],
  sensors: [],
  predictions: [],
  workOrders: [],
  alerts: [],
  pigRuns: [],
  roiConfig: { downtime_cost_per_hour: 0, avg_emergency_repair_cost: 0, avg_planned_repair_cost: 0, currency: 'USD' },
  roiHistory: [],
  edgeGateways: [],
  gatewayList: [],

  dataLoading: false,
  dataError: null,

  selectedSegmentId: null,
  viewMode: 'map',
  activeModal: null,
  drawerOpen: false,
  isOffline: false,
  isSimulatingOffline: false,
  connectivity: {
    cloud: 'online',
    edge_gateways_online: 0,
    edge_gateways_total: 0,
    last_sync: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    offline_buffer_pct: 0,
  },
  pendingSyncCount: 0,
  simulatingLeak: false,

  selectSegment: (id) => set({ selectedSegmentId: id, drawerOpen: id !== null }),
  setViewMode: (mode) => set({ viewMode: mode }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
  toggleDrawer: () => set(s => ({ drawerOpen: !s.drawerOpen })),

  setOffline: (offline) =>
    set(s => ({
      isOffline: offline,
      connectivity: {
        ...s.connectivity,
        cloud: offline ? 'offline' : 'online',
        last_sync: offline ? s.connectivity.last_sync : format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      },
    })),

  toggleSimulateOffline: () => {
    const { isSimulatingOffline, setOffline } = get();
    const next = !isSimulatingOffline;
    set({ isSimulatingOffline: next });
    setOffline(next);
  },

  triggerLeakSimulation: () => {
    console.warn('[useStore] triggerLeakSimulation is a no-op post real-backend wiring -- was tied to mock data.');
  },
  dismissLeakSimulation: () => {
    set({ simulatingLeak: false });
  },


  fetchGateways: async () => {
    try {
      const res = await api.getGateways();
      const gateways = ((res.gateways ?? []) as GatewayConfig[]).map((gateway) => ({
        ...gateway,
        source: gateway.source ?? 'real',
      }));
      set({ gatewayList: gateways });
    } catch (err) {
      console.error('[useStore] fetchGateways failed:', err);
      throw err;
    }
  },

  replaceGatewayList: (gateways: GatewayConfig[]) => set({ gatewayList: gateways }),

  upsertGateway: (gateway: GatewayConfig) =>
    set(s => ({
      gatewayList: [...s.gatewayList.filter(item => item.id !== gateway.id), gateway].sort((a, b) => a.name.localeCompare(b.name)),
    })),

  loadInitialData: async () => {
    set({ dataLoading: true, dataError: null });
    try {
      const [assetsRes, alertsRes, workOrdersRes, predictionsRes, sensorsRes] = await Promise.all([
        api.getAssets(),
        api.getAlerts(),
        api.getWorkOrders(),
        api.getPredictions(),
        api.getSensors(),
      ]);
      set({
        segments: (assetsRes.assets as any[]).map(adaptAsset),
        alerts: (alertsRes.alerts as any[]).map(adaptAlert),
        workOrders: (workOrdersRes.work_orders as any[]).map(adaptWorkOrder),
        predictions: (predictionsRes.predictions as any[]).map(adaptPrediction),
        sensors: (sensorsRes.sensors as any[]).map(adaptSensor),
        dataLoading: false,
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load data from server.';
      set({ dataLoading: false, dataError: message });
      console.error('[useStore] loadInitialData failed:', err);
    }
  },

  acknowledgeAlert: async (id) => {
    const res = await api.acknowledgeAlert(id);
    const adapted = adaptAlert(res.alert as any);
    set(s => ({ alerts: s.alerts.map(a => (a.id === id ? adapted : a)) }));
  },

  createWorkOrder: async (partial) => {
    const res = await api.createWorkOrder(partial);
    const wo = adaptWorkOrder(res.work_order as any);
    set(s => ({ workOrders: [wo, ...s.workOrders] }));
    return wo;
  },

  updateWorkOrder: async (id, updates) => {
    const res = await api.updateWorkOrder(id, updates);
    const wo = adaptWorkOrder(res.work_order as any);
    set(s => ({ workOrders: s.workOrders.map(w => (w.id === id ? wo : w)) }));
  },

  queueOfflineWorkOrder: (wo) => {
    set(s => ({
      workOrders: [{ ...wo, _queued: true }, ...s.workOrders],
      pendingSyncCount: s.pendingSyncCount + 1,
    }));
  },

  syncOfflineQueue: () => {
    set(s => ({
      workOrders: s.workOrders.map(wo =>
        wo._queued ? { ...wo, _queued: false, status: 'pending' as const } : wo
      ),
      pendingSyncCount: 0,
      connectivity: {
        ...s.connectivity,
        last_sync: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      },
    }));
  },

  updateROIConfig: (config) =>
    set(s => ({ roiConfig: { ...s.roiConfig, ...config } })),

  applyStateInit: (payload) => {
    if (payload.error) {
      console.error('[useStore] socket state:init reported a server error:', payload.error);
    }
    set(s => ({
      segments: mergeById(payload.assets, s.segments, mergeAssetFromSocket),
      sensors: mergeById(payload.sensors, s.sensors, mergeSensorFromSocket),
      alerts: mergeById(payload.alerts, s.alerts, mergeAlertFromSocket),
      predictions: mergeById(payload.predictions, s.predictions, mergePredictionFromSocket),
    }));
  },

  mergeActiveAlerts: (alerts) => {
    set(s => ({ alerts: mergeById(alerts, s.alerts, mergeAlertFromSocket) }));
  },

  mergeWorkOrderCreated: (wo) => {
    set(s => ({ workOrders: mergeById([wo], s.workOrders, mergeWorkOrderFromSocket) }));
  },

  mergeAlertAcknowledged: (alert) => {
    set(s => ({ alerts: mergeById([alert], s.alerts, mergeAlertFromSocket) }));
  },

  getSegmentById: (id: string) => get().segments.find(s => s.id === id),

  getPredictionForSegment: (segId: string) =>
    get().predictions.find(p => p.segment_id === segId),

  getSensorsForSegment: (segId: string) =>
    get().sensors.filter(s => s.asset_id === segId),

  getActiveAlerts: () =>
    get().alerts.filter(a => a.status === 'open' || a.status === 'acknowledged' || a.status === 'escalated'),

  getTotalROI: () =>
    get().roiHistory.reduce((sum, m) => sum + m.total_roi, 0),
}));
