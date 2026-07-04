// ─── Core Sensor & Pipeline Types ────────────────────────────────────────────

export type SensorType =
  | 'ultrasonic_thickness'
  | 'acoustic_emission'
  | 'pressure_transmitter'
  | 'flow_meter'
  | 'cathodic_protection'
  | 'fiber_optic_das'
  | 'vibration_accelerometer';

export type Protocol = 'OPC-UA' | 'MQTT' | 'Modbus RTU' | 'HART' | 'DNP3' | 'LoRaWAN' | 'IEPE' | 'Ethernet/IP';

export type HealthStatus = 'good' | 'warning' | 'critical' | 'unknown';

export interface SensorReading {
  sensor_id: string;
  pipeline_segment: string;
  timestamp: string;
  value: number;
  unit: string;
  quality: number;
  was_offline?: boolean;
}

export interface SensorHistoryPoint {
  timestamp: string;
  value: number;
}

export interface Sensor {
  id: string;
  name: string;
  type: SensorType;
  protocol: Protocol;
  segment_id: string;
  mile_marker: number;
  lat: number;
  lng: number;
  last_reading?: SensorReading;
  history: SensorHistoryPoint[];
  last_seen: string;
  battery?: number;
  status: 'online' | 'offline' | 'degraded';
  unit: string;
  normal_range: [number, number];
}

export interface PipelineSegment {
  id: string;
  name: string;
  mile_start: number;
  mile_end: number;
  coordinates: [number, number][];   // [lat, lng][]
  health_score: number;              // 0–100
  health_status: HealthStatus;
  sensors: string[];                 // sensor IDs
  last_pig_run: string | null;
  next_pig_due: string | null;
  material: string;
  diameter_inches: number;
  wall_thickness_mm: number;
  operating_pressure_psi: number;
  max_pressure_psi: number;
  installation_year: number;
  coating_type: string;
}

// ─── AI Prediction Types ──────────────────────────────────────────────────────

export interface RootCauseProbability {
  cause: string;
  probability: number;              // 0–1
  icon: string;
}

export interface ExplanationFeature {
  feature: string;
  contribution: number;             // 0–100 %
  direction: 'positive' | 'negative';
  value: string;                    // human-readable current value
  plain_english: string;
}

export interface ModelMetadata {
  version: string;
  validated: boolean;
  validation_note?: string;
  training_data_description?: string;
  validation_method?: string;
  last_validated_date?: string | null;
  precision?: number | null;
  recall?: number | null;
  false_positive_rate?: number | null;
}

export interface PredictionResult {
  id: string;
  segment_id: string;
  created_at: string;
  anomaly_score: number;            // 0–1
  rul_days: number;
  rul_lower: number;
  rul_upper: number;
  root_cause: RootCauseProbability[];
  primary_failure_mode: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  explanation: ExplanationFeature[];
  model_version: string;
  confidence: number;               // 0–1
  model_metadata?: ModelMetadata;
}


// ─── Work Orders ──────────────────────────────────────────────────────────────

export interface PartItem {
  part_number: string;
  description: string;
  quantity: number;
  in_stock: boolean;
}

export type WorkOrderStatus = 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'critical';

export interface WorkOrder {
  id: string;
  title: string;
  segment_id: string;
  asset_id: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  description: string;
  repair_procedure: string;
  estimated_downtime_hours: number;
  required_tools: string[];
  safety_notes: string[];
  parts_list: PartItem[];
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  completed_at: string | null;
  technician_notes: string | null;
  photos: string[];
  actual_root_cause: string | null;
  prediction_id: string | null;
  // Offline queue metadata
  _queued?: boolean;
  _local_id?: string;
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export type AlertType = 'leak' | 'pressure_surge' | 'corrosion' | 'sensor_offline' | 'anomaly' | 'cathodic_failure';

export interface Alert {
  id: string;
  type: AlertType;
  segment_id: string;
  timestamp: string;
  severity: 'warning' | 'critical';
  message: string;
  confidence: number;               // 0–1
  location: { lat: number; lng: number; radius_m: number } | null;
  acknowledged: boolean;
  triggering_sensors: string[];
}

// ─── PIG Inspection ───────────────────────────────────────────────────────────

export interface PIGFinding {
  mile_marker: number;
  metal_loss_percent: number;
  depth_mm: number;
  length_mm: number;
  width_mm: number;
  feature_type: 'pit' | 'groove' | 'general' | 'crack';
  orientation: string;
}

export interface PIGRun {
  id: string;
  segment_id: string;
  date: string;
  type: 'MFL' | 'UT' | 'geometry' | 'caliper';
  vendor: string;
  tool_speed_mph: number;
  findings: PIGFinding[];
  report_url?: string;
  summary: string;
}

// ─── ROI ──────────────────────────────────────────────────────────────────────

export interface ROIConfig {
  downtime_cost_per_hour: number;
  avg_emergency_repair_cost: number;
  avg_planned_repair_cost: number;
  currency: string;
}

export interface ROIMonthEntry {
  month: string;
  downtime_avoided_hours: number;
  downtime_value: number;
  emergency_repairs_avoided: number;
  emergency_cost_avoided: number;
  planned_vs_emergency_savings: number;
  total_roi: number;
}

// ─── Connectivity ─────────────────────────────────────────────────────────────

export interface EdgeGatewayStatus {
  id: string;
  name: string;
  location: string;
  mile_marker: number;
  lat: number;
  lng: number;
  online: boolean;
  last_seen: string;
  buffer_pct: number;
  cpu_load: number;
  temp_celsius: number;
  sensor_count: number;
}

export interface ConnectivityStatus {
  cloud: 'online' | 'offline' | 'degraded';
  edge_gateways_online: number;
  edge_gateways_total: number;
  last_sync: string;
  offline_buffer_pct: number;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export type ViewMode = 'map' | 'longitudinal';
export type ActiveModal = 'roi' | 'sensors' | 'pig' | 'workorders' | 'leak' | 'report' | null;
