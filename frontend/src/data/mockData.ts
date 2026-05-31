import type {
  PipelineSegment, Sensor, PredictionResult, WorkOrder, Alert,
  PIGRun, ROIMonthEntry, ROIConfig, EdgeGatewayStatus
} from '../types';
import { subDays, subHours, subMinutes, format } from 'date-fns';

// ─── Pipeline Route (West Texas – Permian Basin Corridor) ─────────────────────
// 500-mile crude oil pipeline, Wink TX → Midland Terminal
// Anchor waypoints: [lat, lng]
const ANCHORS: [number, number][] = [
  [31.50, -103.50], // Mile   0 – Wink Pump Station
  [31.63, -103.22], // Mile  50
  [31.78, -102.95], // Mile 100
  [31.92, -102.60], // Mile 150
  [32.05, -102.25], // Mile 200 – Crane Junction
  [32.14, -101.90], // Mile 250
  [32.22, -101.52], // Mile 300 – Midkiff Valve Site
  [32.30, -101.15], // Mile 350
  [32.42, -100.80], // Mile 400
  [32.51, -100.42], // Mile 450
  [32.58, -100.05], // Mile 500 – Midland Terminal
];

function interpolate(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function getCoordForMile(mile: number): [number, number] {
  const totalMiles = 500;
  const segments = ANCHORS.length - 1;
  const milePerSeg = totalMiles / segments;
  const segIdx = Math.min(Math.floor(mile / milePerSeg), segments - 1);
  const t = (mile - segIdx * milePerSeg) / milePerSeg;
  return interpolate(ANCHORS[segIdx], ANCHORS[segIdx + 1], t);
}

// ─── Health Score Profiles ────────────────────────────────────────────────────
// index 0–49 = segments, each covering 10 miles
const HEALTH_OVERRIDE: Record<number, number> = {
  // Critical segments (story: external corrosion at mile 200-210)
  20: 18,  // Mile 200–210  ← CRITICAL: External corrosion
  21: 24,  // Mile 210–220
  // Active leak area (mile 350–370)
  35: 31,  // Mile 350–360  ← CRITICAL: Acoustic + pressure deviation
  36: 29,  // Mile 360–370  ← CRITICAL: Active leak alert
  // Warning band
  14: 55,  // Mile 140–150  ← WARNING: Wall thinning
  15: 48,  // Mile 150–160
  28: 61,  // Mile 280–290  ← WARNING
  42: 57,  // Mile 420–430  ← WARNING: Cathodic protection degraded
};

function healthStatus(score: number) {
  if (score >= 70) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
}

// ─── Generate Segments ────────────────────────────────────────────────────────
export const SEGMENTS: PipelineSegment[] = Array.from({ length: 50 }, (_, i) => {
  const mileStart = i * 10;
  const mileEnd = mileStart + 10;
  const health = HEALTH_OVERRIDE[i] ?? Math.floor(70 + Math.random() * 30);
  const coords: [number, number][] = Array.from({ length: 5 }, (__, j) =>
    getCoordForMile(mileStart + j * 2.5)
  );
  return {
    id: `SEG-${String(i + 1).padStart(3, '0')}`,
    name: `Segment ${String(i + 1).padStart(3, '0')} (Mi ${mileStart}–${mileEnd})`,
    mile_start: mileStart,
    mile_end: mileEnd,
    coordinates: coords,
    health_score: health,
    health_status: healthStatus(health) as PipelineSegment['health_status'],
    sensors: [],
    last_pig_run: i < 30 ? format(subDays(new Date(), 60 + i * 4), 'yyyy-MM-dd') : null,
    next_pig_due: format(subDays(new Date(), -(90 - i * 2)), 'yyyy-MM-dd'),
    material: 'API 5L X65',
    diameter_inches: 24,
    wall_thickness_mm: i === 20 ? 9.1 : i === 21 ? 9.8 : 12.7,
    operating_pressure_psi: 720,
    max_pressure_psi: 1200,
    installation_year: 2004 + (i % 8),
    coating_type: i < 20 ? 'FBE + HDPE' : 'Coal tar enamel',
  };
});

// ─── Generate Sensors ─────────────────────────────────────────────────────────
function makeHistory(
  baseValue: number, noise: number, points = 24
): { timestamp: string; value: number }[] {
  return Array.from({ length: points }, (_, i) => ({
    timestamp: format(subHours(new Date(), points - i), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    value: +(baseValue + (Math.random() - 0.5) * noise * 2).toFixed(3),
  }));
}

export const SENSORS: Sensor[] = [];

SEGMENTS.forEach((seg, si) => {
  const midMile = (seg.mile_start + seg.mile_end) / 2;
  const midCoord = getCoordForMile(midMile);

  // Ultrasonic thickness gauge
  const utId = `UT-${si + 1}-${midMile}`;
  const utValue = seg.wall_thickness_mm;
  SENSORS.push({
    id: utId,
    name: `UT Gauge ${si + 1}`,
    type: 'ultrasonic_thickness',
    protocol: 'Modbus RTU',
    segment_id: seg.id,
    mile_marker: midMile,
    lat: midCoord[0] + 0.001,
    lng: midCoord[1] + 0.001,
    last_reading: {
      sensor_id: utId,
      pipeline_segment: seg.id,
      timestamp: format(subMinutes(new Date(), 5), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      value: utValue,
      unit: 'mm',
      quality: 0.97,
    },
    history: makeHistory(utValue, 0.08),
    last_seen: format(subMinutes(new Date(), 5), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    status: 'online',
    unit: 'mm',
    normal_range: [10, 13],
  });

  // Pressure transmitter
  const ptId = `PT-${si + 1}-${midMile}`;
  const ptBase = si === 35 || si === 36 ? 680 - Math.random() * 40 : 718 + Math.random() * 10;
  SENSORS.push({
    id: ptId,
    name: `Pressure Tx ${si + 1}`,
    type: 'pressure_transmitter',
    protocol: 'Modbus RTU',
    segment_id: seg.id,
    mile_marker: midMile,
    lat: midCoord[0] - 0.001,
    lng: midCoord[1],
    last_reading: {
      sensor_id: ptId,
      pipeline_segment: seg.id,
      timestamp: format(subMinutes(new Date(), 1), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      value: +ptBase.toFixed(1),
      unit: 'PSI',
      quality: 0.99,
    },
    history: makeHistory(ptBase, si === 36 ? 18 : 4),
    last_seen: format(subMinutes(new Date(), 1), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    status: 'online',
    unit: 'PSI',
    normal_range: [700, 750],
  });

  // Acoustic emission (every 2nd segment ~ every 20 miles for brevity)
  if (si % 2 === 0 || si === 35 || si === 36) {
    const aeId = `AE-${si + 1}-${midMile}`;
    const aeBase = si === 36 ? 82 : 12 + Math.random() * 8;
    SENSORS.push({
      id: aeId,
      name: `Acoustic Emission ${si + 1}`,
      type: 'acoustic_emission',
      protocol: 'MQTT',
      segment_id: seg.id,
      mile_marker: midMile,
      lat: midCoord[0],
      lng: midCoord[1] - 0.001,
      last_reading: {
        sensor_id: aeId,
        pipeline_segment: seg.id,
        timestamp: format(subMinutes(new Date(), 2), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        value: +aeBase.toFixed(1),
        unit: 'dB',
        quality: 0.95,
      },
      history: makeHistory(aeBase, si === 36 ? 15 : 2, 24),
      last_seen: format(subMinutes(new Date(), 2), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      status: si === 36 ? 'degraded' : 'online',
      unit: 'dB',
      normal_range: [0, 25],
    });
  }

  // Cathodic protection probe (every 5th segment)
  if (si % 5 === 0) {
    const cpId = `CP-${si + 1}-${midMile}`;
    const cpBase = si === 42 ? -0.72 : -0.85 - Math.random() * 0.05;
    SENSORS.push({
      id: cpId,
      name: `Cathodic Protection ${si + 1}`,
      type: 'cathodic_protection',
      protocol: 'Modbus RTU',
      segment_id: seg.id,
      mile_marker: midMile,
      lat: midCoord[0] + 0.002,
      lng: midCoord[1] + 0.002,
      last_reading: {
        sensor_id: cpId,
        pipeline_segment: seg.id,
        timestamp: format(subHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        value: +cpBase.toFixed(3),
        unit: 'V',
        quality: 0.92,
      },
      history: makeHistory(cpBase, 0.03),
      last_seen: format(subHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      status: si === 42 ? 'degraded' : 'online',
      unit: 'V',
      normal_range: [-1.05, -0.85],
    });
  }

  seg.sensors = SENSORS.filter(s => s.segment_id === seg.id).map(s => s.id);
});

// ─── AI Predictions ───────────────────────────────────────────────────────────
export const PREDICTIONS: PredictionResult[] = [
  {
    id: 'PRED-001',
    segment_id: 'SEG-021', // Mile 200–210 – CRITICAL
    created_at: format(subHours(new Date(), 3), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    anomaly_score: 0.94,
    rul_days: 14,
    rul_lower: 9,
    rul_upper: 21,
    root_cause: [
      { cause: 'External corrosion', probability: 0.71, icon: '🔴' },
      { cause: 'Coating disbondment', probability: 0.18, icon: '🟠' },
      { cause: 'Microbiologically influenced', probability: 0.11, icon: '🟡' },
    ],
    primary_failure_mode: 'External Corrosion – Pitting',
    severity: 'critical',
    explanation: [
      { feature: 'Pressure cycling frequency', contribution: 41, direction: 'positive', value: '18 cycles/day', plain_english: 'High daily pressure fluctuations accelerate fatigue cracking' },
      { feature: 'Coating age & condition', contribution: 33, direction: 'positive', value: 'Coal tar enamel, 20yr', plain_english: 'Ageing coal tar enamel coating showing disbondment indicators' },
      { feature: 'Cumulative rainfall (30d)', contribution: 26, direction: 'positive', value: '142 mm', plain_english: 'Above-average rainfall increases soil moisture and corrosion rate' },
    ],
    model_version: '2.4.1',
    confidence: 0.91,
  },
  {
    id: 'PRED-002',
    segment_id: 'SEG-022', // Mile 210–220
    created_at: format(subHours(new Date(), 6), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    anomaly_score: 0.81,
    rul_days: 28,
    rul_lower: 18,
    rul_upper: 42,
    root_cause: [
      { cause: 'External corrosion', probability: 0.62, icon: '🔴' },
      { cause: 'Coating disbondment', probability: 0.27, icon: '🟠' },
      { cause: 'Stray current', probability: 0.11, icon: '🟡' },
    ],
    primary_failure_mode: 'External Corrosion – General',
    severity: 'critical',
    explanation: [
      { feature: 'Wall thickness trend (7d)', contribution: 48, direction: 'positive', value: '-0.12 mm', plain_english: 'Wall thickness declining at accelerating rate over past week' },
      { feature: 'Cathodic protection potential', contribution: 31, direction: 'positive', value: '-0.79 V (marginal)', plain_english: 'CP potential approaching inadequate protection threshold' },
      { feature: 'Similar historical failures', contribution: 21, direction: 'positive', value: '3 analogues', plain_english: 'Pattern matches 3 historical failures on same pipeline vintage' },
    ],
    model_version: '2.4.1',
    confidence: 0.87,
  },
  {
    id: 'PRED-003',
    segment_id: 'SEG-036', // Mile 350–360 – LEAK
    created_at: format(subMinutes(new Date(), 18), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    anomaly_score: 0.97,
    rul_days: 0,
    rul_lower: 0,
    rul_upper: 1,
    root_cause: [
      { cause: 'Pinhole leak – corrosion pit', probability: 0.85, icon: '🔴' },
      { cause: 'Weld defect propagation', probability: 0.10, icon: '🟠' },
      { cause: 'Third-party damage', probability: 0.05, icon: '🟡' },
    ],
    primary_failure_mode: 'Active Pinhole Leak',
    severity: 'critical',
    explanation: [
      { feature: 'Acoustic emission amplitude', contribution: 52, direction: 'positive', value: '82 dB (threshold: 25)', plain_english: 'Acoustic sensors detecting high-frequency noise consistent with fluid escaping' },
      { feature: 'Negative mass balance (flow Δ)', contribution: 33, direction: 'positive', value: '-2.4 bbl/hr', plain_english: 'Inlet flow exceeds outlet flow – unaccounted volume loss' },
      { feature: 'Pressure drop rate', contribution: 15, direction: 'positive', value: '-8.2 PSI/hr', plain_english: 'Sustained pressure decline faster than normal operational variation' },
    ],
    model_version: '2.4.1',
    confidence: 0.95,
  },
  {
    id: 'PRED-004',
    segment_id: 'SEG-015', // Mile 140–150 – WARNING
    created_at: format(subHours(new Date(), 12), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    anomaly_score: 0.62,
    rul_days: 67,
    rul_lower: 48,
    rul_upper: 92,
    root_cause: [
      { cause: 'Internal corrosion (H₂S)', probability: 0.54, icon: '🟠' },
      { cause: 'Erosion-corrosion', probability: 0.30, icon: '🟡' },
      { cause: 'Pitting corrosion', probability: 0.16, icon: '🟡' },
    ],
    primary_failure_mode: 'Internal Corrosion – Sour Service',
    severity: 'high',
    explanation: [
      { feature: 'H₂S content in crude', contribution: 44, direction: 'positive', value: '420 ppm', plain_english: 'Elevated hydrogen sulfide accelerates internal corrosion at bottom-of-pipe' },
      { feature: 'Flow velocity (avg)', contribution: 32, direction: 'positive', value: '1.2 m/s (low)', plain_english: 'Low flow velocity allows water dropout, increasing corrosion bed' },
      { feature: 'UT wall thickness decline', contribution: 24, direction: 'positive', value: '-0.06 mm/month', plain_english: 'Steady internal metal loss confirmed by online UT monitoring' },
    ],
    model_version: '2.4.1',
    confidence: 0.79,
  },
  {
    id: 'PRED-005',
    segment_id: 'SEG-043', // Mile 420–430 – WARNING: cathodic
    created_at: format(subHours(new Date(), 8), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    anomaly_score: 0.55,
    rul_days: 82,
    rul_lower: 60,
    rul_upper: 105,
    root_cause: [
      { cause: 'Cathodic protection failure', probability: 0.67, icon: '🟠' },
      { cause: 'Coating holiday', probability: 0.22, icon: '🟡' },
      { cause: 'Stray current corrosion', probability: 0.11, icon: '🟡' },
    ],
    primary_failure_mode: 'External Corrosion – CP Deficiency',
    severity: 'medium',
    explanation: [
      { feature: 'CP potential reading', contribution: 55, direction: 'positive', value: '-0.72 V (below -0.85V limit)', plain_english: 'Cathodic protection potential insufficient – bare steel may be unprotected' },
      { feature: 'IR-free potential shift', contribution: 28, direction: 'positive', value: '+130 mV shift', plain_english: 'Significant shift suggests CP rectifier or test post issue' },
      { feature: 'Soil resistivity (area)', contribution: 17, direction: 'positive', value: '800 Ω·cm (aggressive)', plain_english: 'Low resistivity clay soil highly corrosive to unprotected steel' },
    ],
    model_version: '2.4.1',
    confidence: 0.74,
  },
];

// ─── Work Orders ──────────────────────────────────────────────────────────────
export const WORK_ORDERS: WorkOrder[] = [
  {
    id: 'WO-2026-1042',
    title: 'Emergency: External Corrosion Repair – Segment 21 (Mi 200–210)',
    segment_id: 'SEG-021',
    asset_id: 'SEG-021',
    status: 'pending',
    priority: 'critical',
    description: 'AI-detected external corrosion with 14-day RUL. Ultrasonic readings confirm wall thickness at 9.1mm (nominal 12.7mm). Immediate sleeve repair or composite wrap required.',
    repair_procedure: '1. De-rate segment pressure to 480 PSI before entry.\n2. Expose pipe using vacuum excavation (2m window at Mile 205.7).\n3. Abrasive blast to Sa 2.5 finish.\n4. Apply Clock Spring® composite repair sleeve.\n5. Holiday test new coating.\n6. Backfill and compact.\n7. Return to service at 80% MAOP for 30 days.',
    estimated_downtime_hours: 18,
    required_tools: ['Vacuum excavator', 'Abrasive blast unit', 'Composite wrap kit (Clock Spring 6-layer)', 'Holiday detector', 'Ultrasonic thickness gauge'],
    safety_notes: ['H₂S monitor mandatory – ROW has historic H₂S readings', 'LOTO procedure required before excavation', 'Trench shoring for >1.2m depth'],
    parts_list: [
      { part_number: 'CS-6L-24', description: 'Clock Spring 6-layer 24" repair sleeve', quantity: 2, in_stock: true },
      { part_number: 'EP-FBE-2L', description: 'FBE epoxy primer kit (2L)', quantity: 4, in_stock: true },
      { part_number: 'GG-H2S-PT', description: 'H₂S personal gas monitor', quantity: 3, in_stock: true },
    ],
    assigned_to: 'Rodriguez, M.',
    created_at: format(subHours(new Date(), 2), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    updated_at: format(subHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    due_date: format(subDays(new Date(), -3), 'yyyy-MM-dd'),
    completed_at: null,
    technician_notes: null,
    photos: [],
    actual_root_cause: null,
    prediction_id: 'PRED-001',
  },
  {
    id: 'WO-2026-1043',
    title: 'Cathodic Protection Inspection – Segment 43 (Mi 420–430)',
    segment_id: 'SEG-043',
    asset_id: 'SEG-043',
    status: 'in_progress',
    priority: 'high',
    description: 'CP potential has dropped to -0.72V, below the -0.85V minimum for adequate protection. Inspect test post TP-43, check rectifier output, and survey for coating holidays.',
    repair_procedure: '1. Check rectifier output current and voltage at RP-43.\n2. Perform close-interval potential survey (CIPS) from Mile 420 to 432.\n3. Identify and report all anomalies < -0.85V (IR-free).\n4. If rectifier faulty: replace transformer unit.\n5. If coating holiday: dig and repair.',
    estimated_downtime_hours: 0,
    required_tools: ['Reference electrode (CuSO₄)', 'Current interrupter', 'CIPS logger', 'Rectifier test set'],
    safety_notes: ['Traffic control if surveying near road crossings', 'Lone worker check-in every 2 hours'],
    parts_list: [
      { part_number: 'CP-RECT-30A', description: 'CP Rectifier 30A replacement unit', quantity: 1, in_stock: false },
    ],
    assigned_to: 'Okafor, K.',
    created_at: format(subHours(new Date(), 20), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    updated_at: format(subHours(new Date(), 4), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    due_date: format(subDays(new Date(), -7), 'yyyy-MM-dd'),
    completed_at: null,
    technician_notes: 'TP-43 connection wire corroded. Replaced connection. Rectifier appears nominal. Continuing CIPS.',
    photos: [],
    actual_root_cause: null,
    prediction_id: 'PRED-005',
  },
  {
    id: 'WO-2026-1038',
    title: 'Routine Inspection – GIS Verification Segment 29 (Mi 280–290)',
    segment_id: 'SEG-029',
    asset_id: 'SEG-029',
    status: 'completed',
    priority: 'medium',
    description: 'Bi-annual visual inspection and marker verification. No anomalies detected.',
    repair_procedure: 'Visual ROW inspection, stake verification, aerial photography.',
    estimated_downtime_hours: 0,
    required_tools: ['Camera', 'GPS unit', 'Paint stakes'],
    safety_notes: ['RF communication check before entering remote sections'],
    parts_list: [],
    assigned_to: 'Chen, L.',
    created_at: format(subDays(new Date(), 14), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    updated_at: format(subDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    due_date: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    completed_at: format(subDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    technician_notes: 'All markers verified. Minimal vegetation encroachment near Mile 284.',
    photos: [],
    actual_root_cause: null,
    prediction_id: null,
  },
];

// ─── Active Alerts ────────────────────────────────────────────────────────────
export const ALERTS: Alert[] = [
  {
    id: 'ALERT-001',
    type: 'leak',
    segment_id: 'SEG-036',
    timestamp: format(subMinutes(new Date(), 18), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    severity: 'critical',
    message: 'Active leak detected at Mile 361.4 – Acoustic + pressure deviation + mass imbalance',
    confidence: 0.95,
    location: { lat: 32.305, lng: -101.07, radius_m: 200 },
    acknowledged: false,
    triggering_sensors: ['AE-36-365', 'PT-36-365'],
  },
  {
    id: 'ALERT-002',
    type: 'corrosion',
    segment_id: 'SEG-021',
    timestamp: format(subHours(new Date(), 3), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    severity: 'critical',
    message: 'Accelerated wall-loss at Mile 205.7 – 14-day RUL predicted',
    confidence: 0.91,
    location: { lat: 32.047, lng: -102.267, radius_m: 500 },
    acknowledged: false,
    triggering_sensors: ['UT-21-205'],
  },
  {
    id: 'ALERT-003',
    type: 'sensor_offline',
    segment_id: 'SEG-031',
    timestamp: format(subHours(new Date(), 2), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    severity: 'warning',
    message: 'Sensor UT-31-305 offline for 2 hours – using last known value from 12:32',
    confidence: 1.0,
    location: null,
    acknowledged: true,
    triggering_sensors: ['UT-31-305'],
  },
];

// ─── PIG Runs ─────────────────────────────────────────────────────────────────
export const PIG_RUNS: PIGRun[] = [
  {
    id: 'PIG-2024-01',
    segment_id: 'SEG-021',
    date: '2024-02-10',
    type: 'MFL',
    vendor: 'Baker Hughes TDW',
    tool_speed_mph: 3.2,
    summary: '14 metal loss features >10% WT. Max depth 22% WT at MP 205.7. Recommend immediate dig at 3 locations.',
    findings: [
      { mile_marker: 202.3, metal_loss_percent: 12, depth_mm: 1.52, length_mm: 45, width_mm: 20, feature_type: 'pit', orientation: '6 o\'clock' },
      { mile_marker: 205.7, metal_loss_percent: 28, depth_mm: 3.56, length_mm: 120, width_mm: 65, feature_type: 'general', orientation: '5-7 o\'clock' },
      { mile_marker: 207.1, metal_loss_percent: 15, depth_mm: 1.91, length_mm: 55, width_mm: 25, feature_type: 'pit', orientation: '6 o\'clock' },
      { mile_marker: 208.9, metal_loss_percent: 11, depth_mm: 1.40, length_mm: 35, width_mm: 18, feature_type: 'pit', orientation: '4 o\'clock' },
    ],
  },
  {
    id: 'PIG-2022-01',
    segment_id: 'SEG-021',
    date: '2022-08-15',
    type: 'MFL',
    vendor: 'Rosen Group',
    tool_speed_mph: 3.5,
    summary: '6 metal loss features. Max depth 12% WT at MP 205.7.',
    findings: [
      { mile_marker: 202.3, metal_loss_percent: 7, depth_mm: 0.89, length_mm: 30, width_mm: 15, feature_type: 'pit', orientation: '6 o\'clock' },
      { mile_marker: 205.7, metal_loss_percent: 12, depth_mm: 1.52, length_mm: 70, width_mm: 40, feature_type: 'general', orientation: '5-7 o\'clock' },
      { mile_marker: 207.1, metal_loss_percent: 8, depth_mm: 1.02, length_mm: 35, width_mm: 18, feature_type: 'pit', orientation: '6 o\'clock' },
    ],
  },
];

// ─── ROI Data ─────────────────────────────────────────────────────────────────
export const ROI_CONFIG: ROIConfig = {
  downtime_cost_per_hour: 45000,
  avg_emergency_repair_cost: 380000,
  avg_planned_repair_cost: 95000,
  currency: 'USD',
};

export const ROI_HISTORY: ROIMonthEntry[] = [
  { month: 'Jan 2026', downtime_avoided_hours: 14, downtime_value: 630000, emergency_repairs_avoided: 1, emergency_cost_avoided: 380000, planned_vs_emergency_savings: 285000, total_roi: 1295000 },
  { month: 'Feb 2026', downtime_avoided_hours: 8, downtime_value: 360000, emergency_repairs_avoided: 0, emergency_cost_avoided: 0, planned_vs_emergency_savings: 285000, total_roi: 645000 },
  { month: 'Mar 2026', downtime_avoided_hours: 22, downtime_value: 990000, emergency_repairs_avoided: 2, emergency_cost_avoided: 760000, planned_vs_emergency_savings: 570000, total_roi: 2320000 },
  { month: 'Apr 2026', downtime_avoided_hours: 10, downtime_value: 450000, emergency_repairs_avoided: 1, emergency_cost_avoided: 380000, planned_vs_emergency_savings: 285000, total_roi: 1115000 },
  { month: 'May 2026', downtime_avoided_hours: 6, downtime_value: 270000, emergency_repairs_avoided: 1, emergency_cost_avoided: 380000, planned_vs_emergency_savings: 285000, total_roi: 935000 },
];

// ─── Edge Gateways ────────────────────────────────────────────────────────────
export const EDGE_GATEWAYS: EdgeGatewayStatus[] = [
  { id: 'EG-01', name: 'Wink Pump Station', location: 'Wink, TX', mile_marker: 0, lat: 31.50, lng: -103.50, online: true, last_seen: format(subMinutes(new Date(), 1), "yyyy-MM-dd'T'HH:mm:ss'Z'"), buffer_pct: 4, cpu_load: 23, temp_celsius: 42, sensor_count: 18 },
  { id: 'EG-02', name: 'Kermit Section', location: 'Kermit, TX', mile_marker: 50, lat: 31.63, lng: -103.22, online: true, last_seen: format(subMinutes(new Date(), 2), "yyyy-MM-dd'T'HH:mm:ss'Z'"), buffer_pct: 8, cpu_load: 31, temp_celsius: 45, sensor_count: 22 },
  { id: 'EG-03', name: 'Crane Junction', location: 'Crane, TX', mile_marker: 150, lat: 31.92, lng: -102.60, online: true, last_seen: format(subMinutes(new Date(), 1), "yyyy-MM-dd'T'HH:mm:ss'Z'"), buffer_pct: 3, cpu_load: 18, temp_celsius: 39, sensor_count: 20 },
  { id: 'EG-04', name: 'Midkiff Valve Site', location: 'Midkiff, TX', mile_marker: 250, lat: 32.14, lng: -101.90, online: false, last_seen: format(subHours(new Date(), 3), "yyyy-MM-dd'T'HH:mm:ss'Z'"), buffer_pct: 64, cpu_load: 0, temp_celsius: 0, sensor_count: 19 },
  { id: 'EG-05', name: 'Garden City Site', location: 'Garden City, TX', mile_marker: 350, lat: 32.30, lng: -101.15, online: true, last_seen: format(subMinutes(new Date(), 1), "yyyy-MM-dd'T'HH:mm:ss'Z'"), buffer_pct: 6, cpu_load: 41, temp_celsius: 48, sensor_count: 21 },
  { id: 'EG-06', name: 'Midland Terminal', location: 'Midland, TX', mile_marker: 500, lat: 32.58, lng: -100.05, online: true, last_seen: format(subMinutes(new Date(), 1), "yyyy-MM-dd'T'HH:mm:ss'Z'"), buffer_pct: 2, cpu_load: 15, temp_celsius: 37, sensor_count: 16 },
];

// ─── Longitudinal Data (wall thickness + pressure across 500 miles) ───────────
export interface LongitudinalPoint {
  mile: number;
  wall_thickness: number;
  pressure: number;
  health_score: number;
  corrosion_rate: number;   // mm/yr
  pig_2022?: number;        // % metal loss from 2022 PIG
  pig_2024?: number;        // % metal loss from 2024 PIG
  forecast?: number;        // predicted % metal loss in 2027
}

export const LONGITUDINAL_DATA: LongitudinalPoint[] = Array.from({ length: 100 }, (_, i) => {
  const mile = i * 5;
  const segIdx = Math.floor(mile / 10);
  const seg = SEGMENTS[Math.min(segIdx, 49)];
  const baseThickness = seg.wall_thickness_mm;
  const corrRate = seg.health_score < 30 ? 0.8 : seg.health_score < 60 ? 0.25 : 0.08;
  return {
    mile,
    wall_thickness: +(baseThickness + (Math.random() - 0.5) * 0.4).toFixed(2),
    pressure: +(715 + (Math.random() - 0.5) * 20 + (segIdx === 35 || segIdx === 36 ? -35 : 0)).toFixed(1),
    health_score: seg.health_score,
    corrosion_rate: +corrRate.toFixed(3),
    pig_2022: mile >= 200 && mile <= 210 ? 7 + (mile - 200) * 0.5 : undefined,
    pig_2024: mile >= 200 && mile <= 210 ? 12 + (mile - 200) * 1.6 : undefined,
    forecast: mile >= 200 && mile <= 210 ? 19 + (mile - 200) * 2.2 : undefined,
  };
});
