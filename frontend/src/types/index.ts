// ─── Core Sensor & Pipeline Types ────────────────────────────────────────────

export type SensorType =
  | 'ultrasonic_thickness'
  | 'acoustic_emission'
  | 'pressure_transmitter'
  | 'flow_meter'
  | 'cathodic_protection'
  | 'fiber_optic_das'
  | 'vibration_accelerometer';

export type Protocol = 'OPC-UA' | 'MQTT' | 'Modbus TCP' | 'HART' | 'DNP3' | 'LoRaWAN' | 'IEPE' | 'Ethernet/IP';

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
  asset_id: string;
  sensor_type: string;
  unit: string;
  baseline_value: number | null;
  baseline_updated_at: string | null;
  hard_min: number | null;
  hard_max: number | null;
  manual_override_min: number | null;
  manual_override_max: number | null;
  created_at: string;
  asset_name?: string;
  platform?: string;
  latitude?: number;
  longitude?: number;
  status: 'online' | 'offline';
  last_value: number | null;
  last_seen: string | null;

  name?: string;
  type?: SensorType;
  protocol?: Protocol;
  segment_id?: string;
  mile_marker?: number;
  lat?: number;
  lng?: number;
  last_reading?: SensorReading;
  history?: SensorHistoryPoint[];
  battery?: number;
  normal_range?: [number, number];
}

export interface PipelineSegment {
  id: string;
  name: string;
  platform: string;
  line: string | null;
  zone: 'good' | 'warning' | 'critical' | string | null;
  latitude: number | null;
  longitude: number | null;
  replacement_cost: number | null;
  downtime_cost_per_hour: number | null;
  priority: 'low' | 'medium' | 'high' | 'critical' | 'unset';
  is_low_priority: boolean;
  route: { lat: number; lng: number }[] | null;
  health_score: number | null;
  health_score_open_alerts: number;
  created_at: string;
  updated_at: string;

  mile_start?: number;
  mile_end?: number;
  coordinates?: [number, number][];
  health_status?: HealthStatus;
  sensors?: string[];
  last_pig_run?: string | null;
  next_pig_due?: string | null;
  material?: string;
  diameter_inches?: number;
  wall_thickness_mm?: number;
  operating_pressure_psi?: number;
  max_pressure_psi?: number;
  installation_year?: number;
  coating_type?: string;
}

export interface RootCauseProbability {
  cause: string;
  probability: number;
  icon: string;
}

export interface ExplanationFeature {
  feature: string;
  contribution: number;
  direction: 'positive' | 'negative';
  value: string;
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
  anomaly_score: number | null;
  rul_days: number | null;
  rul_lower: number | null;
  rul_upper: number | null;
  failure_mode: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  model_version: string | null;
  raw_output: unknown;

  root_cause?: RootCauseProbability[];
  primary_failure_mode?: string;
  explanation?: ExplanationFeature[];
  confidence?: number;
  model_metadata?: ModelMetadata;
}

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
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  description: string | null;
  repair_procedure: string | null;
  estimated_downtime_hours: number;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  completed_at: string | null;
  prediction_id: string | null;
  technician_notes: string | null;
  actual_root_cause: string | null;
  alert_id: string | null;

  asset_id?: string;
  required_tools?: string[];
  safety_notes?: string[];
  parts_list?: PartItem[];
  photos?: string[];

  _queued?: boolean;
  _local_id?: string;
}

export type AlertType = 'leak' | 'pressure_surge' | 'corrosion' | 'sensor_offline' | 'anomaly' | 'cathodic_failure';

export interface Alert {
  id: string;
  asset_id: string;
  prediction_id: string | null;
  root_cause_signature: string;
  source: 'rule' | 'ml';
  tier: 'red' | 'yellow' | 'green';
  trigger_summary: string;
  recommended_action: string;
  confidence: number | null;
  status: 'open' | 'acknowledged' | 'escalated' | 'resolved';
  dwell_start_at: string | null;
  ignored_count: number;
  escalated_to: string | null;
  cost_avoided_estimate: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  asset_name?: string;
  platform?: string;
  line?: string;
  zone?: string;

  type?: AlertType;
  segment_id?: string;
  timestamp?: string;
  severity?: 'warning' | 'critical';
  message?: string;
  location?: { lat: number; lng: number; radius_m: number } | null;
  acknowledged?: boolean;
  triggering_sensors?: string[];
}

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

export type ViewMode = 'map' | 'longitudinal';
export type ActiveModal = 'roi' | 'sensors' | 'pig' | 'workorders' | 'leak' | 'report' | 'gateways' | null;
