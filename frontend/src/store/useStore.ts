import { create } from 'zustand';
import type {
  PipelineSegment, Sensor, PredictionResult, WorkOrder, Alert,
  PIGRun, ROIConfig, ROIMonthEntry, EdgeGatewayStatus,
  ViewMode, ActiveModal, ConnectivityStatus
} from '../types';
import {
  SEGMENTS, SENSORS, PREDICTIONS, WORK_ORDERS, ALERTS,
  PIG_RUNS, ROI_CONFIG, ROI_HISTORY, EDGE_GATEWAYS
} from '../data/mockData';
import { format } from 'date-fns';

interface AppState {
  // Data
  segments: PipelineSegment[];
  sensors: Sensor[];
  predictions: PredictionResult[];
  workOrders: WorkOrder[];
  alerts: Alert[];
  pigRuns: PIGRun[];
  roiConfig: ROIConfig;
  roiHistory: ROIMonthEntry[];
  edgeGateways: EdgeGatewayStatus[];

  // UI State
  selectedSegmentId: string | null;
  viewMode: ViewMode;
  activeModal: ActiveModal;
  drawerOpen: boolean;
  isOffline: boolean;
  isSimulatingOffline: boolean;
  connectivity: ConnectivityStatus;
  pendingSyncCount: number;
  simulatingLeak: boolean;

  // Actions - UI
  selectSegment: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;
  toggleDrawer: () => void;
  setOffline: (offline: boolean) => void;
  toggleSimulateOffline: () => void;
  triggerLeakSimulation: () => void;
  dismissLeakSimulation: () => void;

  // Actions - Data
  acknowledgeAlert: (id: string) => void;
  createWorkOrder: (wo: Partial<WorkOrder>) => WorkOrder;
  updateWorkOrder: (id: string, updates: Partial<WorkOrder>) => void;
  queueOfflineWorkOrder: (wo: WorkOrder) => void;
  syncOfflineQueue: () => void;
  updateROIConfig: (config: Partial<ROIConfig>) => void;

  // Derived
  getSegmentById: (id: string) => PipelineSegment | undefined;
  getPredictionForSegment: (segId: string) => PredictionResult | undefined;
  getSensorsForSegment: (segId: string) => Sensor[];
  getActiveAlerts: () => Alert[];
  getTotalROI: () => number;
}

let woCounter = 1044;

export const useStore = create<AppState>((set, get) => ({
  // ── Initial Data ────────────────────────────────────────────────────────────
  segments: SEGMENTS,
  sensors: SENSORS,
  predictions: PREDICTIONS,
  workOrders: WORK_ORDERS,
  alerts: ALERTS,
  pigRuns: PIG_RUNS,
  roiConfig: ROI_CONFIG,
  roiHistory: ROI_HISTORY,
  edgeGateways: EDGE_GATEWAYS,

  // ── UI State ─────────────────────────────────────────────────────────────────
  selectedSegmentId: null,
  viewMode: 'map',
  activeModal: null,
  drawerOpen: false,
  isOffline: false,
  isSimulatingOffline: false,
  connectivity: {
    cloud: 'online',
    edge_gateways_online: 5,
    edge_gateways_total: 6,
    last_sync: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    offline_buffer_pct: 4,
  },
  pendingSyncCount: 0,
  simulatingLeak: false,

  // ── UI Actions ────────────────────────────────────────────────────────────────
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
    set({ simulatingLeak: true });
    // Mark SEG-037 leak alert as not acknowledged
    set(s => ({
      alerts: s.alerts.map(a =>
        a.id === 'ALERT-001' ? { ...a, acknowledged: false } : a
      ),
    }));
  },

  dismissLeakSimulation: () => {
    set({ simulatingLeak: false });
    set(s => ({
      alerts: s.alerts.map(a =>
        a.id === 'ALERT-001' ? { ...a, acknowledged: true } : a
      ),
    }));
  },

  // ── Data Actions ──────────────────────────────────────────────────────────────
  acknowledgeAlert: (id) =>
    set(s => ({
      alerts: s.alerts.map(a => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),

  createWorkOrder: (partial) => {
    const wo: WorkOrder = {
      id: `WO-2026-${woCounter++}`,
      title: partial.title ?? 'New Work Order',
      segment_id: partial.segment_id ?? '',
      asset_id: partial.asset_id ?? '',
      status: 'draft',
      priority: partial.priority ?? 'medium',
      description: partial.description ?? '',
      repair_procedure: partial.repair_procedure ?? '',
      estimated_downtime_hours: partial.estimated_downtime_hours ?? 0,
      required_tools: partial.required_tools ?? [],
      safety_notes: partial.safety_notes ?? [],
      parts_list: partial.parts_list ?? [],
      assigned_to: partial.assigned_to ?? null,
      created_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      updated_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      due_date: partial.due_date ?? null,
      completed_at: null,
      technician_notes: null,
      photos: [],
      actual_root_cause: null,
      prediction_id: partial.prediction_id ?? null,
    };
    set(s => ({ workOrders: [wo, ...s.workOrders] }));
    return wo;
  },

  updateWorkOrder: (id, updates) =>
    set(s => ({
      workOrders: s.workOrders.map(wo =>
        wo.id === id
          ? { ...wo, ...updates, updated_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'") }
          : wo
      ),
    })),

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

  // ── Derived ───────────────────────────────────────────────────────────────────
  getSegmentById: (id) => get().segments.find(s => s.id === id),

  getPredictionForSegment: (segId) =>
    get().predictions.find(p => p.segment_id === segId),

  getSensorsForSegment: (segId) =>
    get().sensors.filter(s => s.segment_id === segId),

  getActiveAlerts: () =>
    get().alerts.filter(a => !a.acknowledged),

  getTotalROI: () =>
    get().roiHistory.reduce((sum, m) => sum + m.total_roi, 0),
}));
