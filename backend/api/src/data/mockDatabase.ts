import { v4 as uuidv4 } from 'uuid';
import { subDays, subHours, subMonths, format } from 'date-fns';

// ─────────────────────────────── Types ───────────────────────────────────────

interface Sensor {
  id: string;
  type: string;
  protocol: string;
  segment_id: string;
  mile_marker: number;
  lat: number;
  lng: number;
  status: 'online' | 'offline' | 'degraded';
  last_value: number;
  unit: string;
  normal_range: [number, number];
  last_seen: string;
  quality: number;
}

interface PipelineSegment {
  id: string;
  name: string;
  mile_start: number;
  mile_end: number;
  coordinates: [number, number][];
  health_score: number;
  health_status: 'good' | 'warning' | 'critical';
  material: string;
  diameter_inches: number;
  wall_thickness_nominal_mm: number;
  wall_thickness_current_mm: number;
  operating_pressure_psi: number;
  installation_year: number;
  sensors: string[];
  last_pig_run: string;
  next_pig_due: string;
}

interface PredictionResult {
  id: string;
  segment_id: string;
  created_at: string;
  anomaly_score: number;
  rul_days: number;
  rul_lower: number;
  rul_upper: number;
  root_cause: { cause: string; probability: number }[];
  failure_mode: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  explanation: { feature: string; contribution: number; direction: 'positive' | 'negative'; value: string }[];
  model_confidence: number;
}

interface WorkOrder {
  id: string;
  title: string;
  segment_id: string;
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  repair_procedure: string;
  estimated_downtime_hours: number;
  required_tools: string[];
  safety_notes: string[];
  parts_list: { part_number: string; description: string; quantity: number; in_stock: boolean }[];
  assigned_to: string;
  created_at: string;
  updated_at: string;
  due_date: string;
  prediction_id?: string;
}

interface Alert {
  id: string;
  type: 'leak' | 'pressure_surge' | 'corrosion' | 'sensor_offline' | 'anomaly';
  segment_id: string;
  timestamp: string;
  severity: 'warning' | 'critical';
  message: string;
  confidence?: number;
  location?: { lat: number; lng: number; radius_m: number };
  acknowledged: boolean;
}

// ─────────────────────────────── Pipeline Geometry ────────────────────────────

// West Texas (Permian Basin) pipeline route: Wink TX → Midland Terminal
const ANCHORS: [number, number][] = [
  [31.57, -103.48], // Mile 0   – Wink Station
  [31.68, -103.21], // Mile 50
  [31.82, -102.89], // Mile 100
  [31.95, -102.51], // Mile 150
  [32.05, -102.14], // Mile 200
  [32.12, -101.78], // Mile 250
  [32.22, -101.35], // Mile 300
  [32.34, -101.02], // Mile 350
  [32.42, -100.68], // Mile 400
  [32.51, -100.34], // Mile 450
  [32.58, -99.95],  // Mile 500 – Midland Terminal
];

/** Linearly interpolate between anchor waypoints to get [lat,lng] at any mile */
function interpolateMile(mile: number): [number, number] {
  const maxMile = 500;
  const t = (mile / maxMile) * (ANCHORS.length - 1);
  const i = Math.min(Math.floor(t), ANCHORS.length - 2);
  const f = t - i;
  return [
    ANCHORS[i][0] + f * (ANCHORS[i + 1][0] - ANCHORS[i][0]),
    ANCHORS[i][1] + f * (ANCHORS[i + 1][1] - ANCHORS[i][1]),
  ];
}

/** Build a polyline path for a segment (start mile → end mile) */
function segmentPath(mileStart: number, mileEnd: number): [number, number][] {
  const steps = 5;
  const path: [number, number][] = [];
  for (let s = 0; s <= steps; s++) {
    const m = mileStart + (s / steps) * (mileEnd - mileStart);
    path.push(interpolateMile(m));
  }
  return path;
}

// ─────────────────────────────── Health Overrides ─────────────────────────────
// Index = segment index (0-based).  Lower score → worse health.
const HEALTH_OVERRIDES: Record<number, number> = {
  14: 52,  // SEG-015  Mile 140-150  WARNING  internal corrosion
  20: 18,  // SEG-021  Mile 200-210  CRITICAL external corrosion (main story)
  21: 44,  // SEG-022  Mile 210-220  WARNING  (adjacent degradation)
  35: 31,  // SEG-036  Mile 350-360  CRITICAL active leak signature
  36: 29,  // SEG-037  Mile 360-370  CRITICAL active leak epicentre
  42: 63,  // SEG-043  Mile 420-430  WARNING  CP failure start
};

function healthStatus(score: number): 'good' | 'warning' | 'critical' {
  if (score >= 70) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
}

// ─────────────────────────────── Generate Segments ───────────────────────────

function buildSegments(): PipelineSegment[] {
  const segments: PipelineSegment[] = [];
  for (let i = 0; i < 50; i++) {
    const mileStart = i * 10;
    const mileEnd = mileStart + 10;
    const id = `SEG-${String(i + 1).padStart(3, '0')}`;
    const healthScore = HEALTH_OVERRIDES[i] ?? Math.min(100, 72 + Math.round(Math.sin(i * 0.7) * 12 + Math.cos(i * 1.3) * 8));
    const wallBase = 10.2;
    const wallCurrent = HEALTH_OVERRIDES[i]
      ? wallBase - (1 - HEALTH_OVERRIDES[i] / 100) * 4
      : wallBase - Math.random() * 0.5;

    segments.push({
      id,
      name: `${id} Mile ${mileStart}–${mileEnd}`,
      mile_start: mileStart,
      mile_end: mileEnd,
      coordinates: segmentPath(mileStart, mileEnd),
      health_score: healthScore,
      health_status: healthStatus(healthScore),
      material: 'X65 Carbon Steel',
      diameter_inches: 30,
      wall_thickness_nominal_mm: wallBase,
      wall_thickness_current_mm: +wallCurrent.toFixed(2),
      operating_pressure_psi: 820 + Math.round(Math.sin(i * 0.4) * 80),
      installation_year: 1992 + Math.floor(i / 8),
      sensors: [],
      last_pig_run: format(subMonths(new Date(), 6 + (i % 18)), 'yyyy-MM-dd'),
      next_pig_due: format(subMonths(new Date(), -18 + (i % 6)), 'yyyy-MM-dd'),
    });
  }
  return segments;
}

// ─────────────────────────────── Generate Sensors ─────────────────────────────

const SENSOR_TYPES = [
  { type: 'ultrasonic_thickness', unit: 'mm', range: [8.0, 10.5] as [number, number], protocol: 'OPC-UA' },
  { type: 'pressure_transmitter', unit: 'psi', range: [700, 980] as [number, number], protocol: 'HART' },
  { type: 'acoustic_emission', unit: 'dB', range: [20, 65] as [number, number], protocol: 'IEPE' },
  { type: 'cathodic_protection', unit: 'mV', range: [-950, -800] as [number, number], protocol: 'Modbus' },
];

function buildSensors(segments: PipelineSegment[]): Sensor[] {
  const sensors: Sensor[] = [];
  let sensorIndex = 0;

  segments.forEach((seg) => {
    SENSOR_TYPES.forEach((spec) => {
      const sensorId = `SEN-${String(sensorIndex + 1).padStart(4, '0')}`;
      const midMile = (seg.mile_start + seg.mile_end) / 2;
      const pos = interpolateMile(midMile);

      // Make sensors in critical segments show degraded values
      const isCritical = seg.health_status === 'critical';
      const [lo, hi] = spec.range;
      const center = (lo + hi) / 2;
      const value = isCritical
        ? lo + Math.random() * (center - lo) * 0.5  // near-low end = bad
        : center + (Math.random() - 0.5) * (hi - lo) * 0.5; // normal spread

      const status: 'online' | 'offline' | 'degraded' =
        isCritical && Math.random() < 0.2 ? 'degraded'
          : Math.random() < 0.03 ? 'offline'
            : 'online';

      sensors.push({
        id: sensorId,
        type: spec.type,
        protocol: spec.protocol,
        segment_id: seg.id,
        mile_marker: midMile,
        lat: pos[0] + (Math.random() - 0.5) * 0.005,
        lng: pos[1] + (Math.random() - 0.5) * 0.005,
        status,
        last_value: +value.toFixed(3),
        unit: spec.unit,
        normal_range: spec.range,
        last_seen: format(subMinutes(new Date(), status === 'offline' ? 240 : Math.floor(Math.random() * 5)), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        quality: status === 'offline' ? 0 : status === 'degraded' ? 60 + Math.random() * 20 : 90 + Math.random() * 10,
      });

      seg.sensors.push(sensorId);
      sensorIndex++;
    });
  });

  return sensors;
}

function subMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() - minutes * 60_000);
}

// ─────────────────────────────── Predictions ──────────────────────────────────

function buildPredictions(): PredictionResult[] {
  return [
    {
      id: 'PRED-001',
      segment_id: 'SEG-021',
      created_at: new Date().toISOString(),
      anomaly_score: 0.91,
      rul_days: 14,
      rul_lower: 9,
      rul_upper: 21,
      root_cause: [
        { cause: 'External Corrosion (Soil)', probability: 0.74 },
        { cause: 'Coating Disbondment', probability: 0.18 },
        { cause: 'Stray Current', probability: 0.08 },
      ],
      failure_mode: 'External wall loss leading to pinhole leak',
      severity: 'critical',
      explanation: [
        { feature: 'UT Wall Thickness Trend (30d)', contribution: 38, direction: 'positive', value: '−0.18 mm/month' },
        { feature: 'CP Potential Deviation', contribution: 27, direction: 'positive', value: '−720 mV (under-protected)' },
        { feature: 'Acoustic Emission Count', contribution: 19, direction: 'positive', value: '142 events/day ↑' },
        { feature: 'Soil Resistivity (GIS)', contribution: 11, direction: 'positive', value: '320 Ω·cm (corrosive)' },
        { feature: 'Age × Coating Age', contribution: 5, direction: 'positive', value: '31yr pipe / 15yr coating' },
      ],
      model_confidence: 0.87,
    },
    {
      id: 'PRED-002',
      segment_id: 'SEG-022',
      created_at: new Date().toISOString(),
      anomaly_score: 0.68,
      rul_days: 28,
      rul_lower: 18,
      rul_upper: 42,
      root_cause: [
        { cause: 'Coating Disbondment', probability: 0.55 },
        { cause: 'External Corrosion (Soil)', probability: 0.35 },
        { cause: 'Mechanical Damage', probability: 0.10 },
      ],
      failure_mode: 'Coating failure enabling accelerated corrosion',
      severity: 'high',
      explanation: [
        { feature: 'UT Wall Thickness Trend (30d)', contribution: 41, direction: 'positive', value: '−0.12 mm/month' },
        { feature: 'CP Potential Deviation', contribution: 24, direction: 'positive', value: '−810 mV (marginal)' },
        { feature: 'Acoustic Emission Count', contribution: 21, direction: 'positive', value: '98 events/day ↑' },
        { feature: 'Previous MFL Findings', contribution: 14, direction: 'positive', value: '3 anomalies in 2022 run' },
      ],
      model_confidence: 0.79,
    },
    {
      id: 'PRED-003',
      segment_id: 'SEG-036',
      created_at: new Date().toISOString(),
      anomaly_score: 0.97,
      rul_days: 0,
      rul_lower: 0,
      rul_upper: 3,
      root_cause: [
        { cause: 'Pinhole Leak (Active)', probability: 0.89 },
        { cause: 'Weld Seam Defect', probability: 0.07 },
        { cause: 'Third-Party Damage', probability: 0.04 },
      ],
      failure_mode: 'Active hydro-carbon release detected by DAS',
      severity: 'critical',
      explanation: [
        { feature: 'Fiber-Optic DAS (Acoustic)', contribution: 52, direction: 'positive', value: 'Leak signature 2.4×10⁶ magnitude' },
        { feature: 'Flow Balance Discrepancy', contribution: 28, direction: 'positive', value: '−1.8% vs inlet' },
        { feature: 'Pressure Drop Rate', contribution: 13, direction: 'positive', value: '−4.2 psi/hr anomalous' },
        { feature: 'AE Frequency Spectrum', contribution: 7, direction: 'positive', value: 'Turbulent flow signature' },
      ],
      model_confidence: 0.94,
    },
    {
      id: 'PRED-004',
      segment_id: 'SEG-015',
      created_at: new Date().toISOString(),
      anomaly_score: 0.52,
      rul_days: 67,
      rul_lower: 45,
      rul_upper: 92,
      root_cause: [
        { cause: 'Internal Corrosion (CO₂)', probability: 0.62 },
        { cause: 'Erosion-Corrosion', probability: 0.28 },
        { cause: 'Microbiologically Influenced', probability: 0.10 },
      ],
      failure_mode: 'Internal wall loss at bottom-of-pipe (6 o\'clock)',
      severity: 'medium',
      explanation: [
        { feature: 'Water Cut Trend', contribution: 35, direction: 'positive', value: '18% → 34% (90d)' },
        { feature: 'UT Bottom-Pipe Thickness', contribution: 30, direction: 'positive', value: '9.1 mm (nominal 10.2)' },
        { feature: 'CO₂ Partial Pressure', contribution: 20, direction: 'positive', value: '42 psi (corrosive regime)' },
        { feature: 'Flow Velocity', contribution: 15, direction: 'negative', value: '2.8 m/s (>1.5 m/s protective)' },
      ],
      model_confidence: 0.72,
    },
    {
      id: 'PRED-005',
      segment_id: 'SEG-043',
      created_at: new Date().toISOString(),
      anomaly_score: 0.43,
      rul_days: 82,
      rul_lower: 60,
      rul_upper: 115,
      root_cause: [
        { cause: 'Cathodic Protection Failure', probability: 0.71 },
        { cause: 'Anode Depletion', probability: 0.21 },
        { cause: 'Shielding by Disbonded Coating', probability: 0.08 },
      ],
      failure_mode: 'CP under-protection enabling corrosion onset',
      severity: 'medium',
      explanation: [
        { feature: 'CP Rectifier Output', contribution: 48, direction: 'positive', value: 'Rectifier #12 output −42%' },
        { feature: 'CP Potential (Pipe-to-Soil)', contribution: 32, direction: 'positive', value: '−720 mV (target −850 mV)' },
        { feature: 'UT Wall Thickness Trend', contribution: 12, direction: 'positive', value: 'Stable (no action yet)' },
        { feature: 'Days Since CP Survey', contribution: 8, direction: 'positive', value: '187d (overdue)' },
      ],
      model_confidence: 0.68,
    },
  ];
}

// ─────────────────────────────── Work Orders ──────────────────────────────────

function buildWorkOrders(segments: PipelineSegment[]): WorkOrder[] {
  return [
    {
      id: 'WO-2026-1042',
      title: 'Emergency Coating Repair & Corrosion Inhibitor Injection — SEG-021',
      segment_id: 'SEG-021',
      status: 'pending',
      priority: 'critical',
      description: 'AI system has flagged SEG-021 at Mile 200–210 with 14-day remaining useful life. External corrosion at a disbonded coating site is accelerating (−0.18 mm/month). Immediate intervention required to prevent pipeline failure.',
      repair_procedure: '1. Excavate coating anomaly site (GPS: 32.05°N 102.14°W)\n2. Clean to bare metal (SSPC-SP6)\n3. Apply 2-part epoxy coating (Jotafield PRO-15)\n4. Backfill and compact\n5. Verify CP potential readings post-repair',
      estimated_downtime_hours: 6,
      required_tools: ['Excavator JD 310', 'Sand blast unit', 'Coating applicator', 'CP test station kit'],
      safety_notes: [
        'Hot work permit required',
        'H2S monitoring mandatory (≥5ppm action level)',
        'Isolate CP rectifier during metalwork',
        'Gas detector must read 0% LEL before excavation',
      ],
      parts_list: [
        { part_number: 'JF-PRO15-20L', description: 'Jotafield PRO-15 epoxy coating', quantity: 2, in_stock: true },
        { part_number: 'CP-MGX-5A', description: 'Magnesium test anode 5kg', quantity: 3, in_stock: true },
        { part_number: 'WT-SS-2IN', description: 'Weld test coupons SS 2"', quantity: 10, in_stock: false },
      ],
      assigned_to: 'Martinez, Carlos (Tech Lead)',
      created_at: format(subHours(new Date(), 4), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      updated_at: new Date().toISOString(),
      due_date: format(subDays(new Date(), -3), 'yyyy-MM-dd'),
      prediction_id: 'PRED-001',
    },
    {
      id: 'WO-2026-1043',
      title: 'Internal Corrosion Monitoring Enhancement — SEG-015',
      segment_id: 'SEG-015',
      status: 'in_progress',
      priority: 'high',
      description: 'Increase UT measurement frequency and add corrosion coupon to track CO₂ corrosion at bottom-of-pipe. Water cut increase flagged 67-day RUL.',
      repair_procedure: '1. Install UT permanent mount at 6 o\'clock position\n2. Insert coupon access fitting\n3. Inject corrosion inhibitor (batch)\n4. Configure remote monitoring to 1-hour interval',
      estimated_downtime_hours: 2,
      required_tools: ['UT transducer mount kit', 'Coupon access fitting', 'Chemical injection pump'],
      safety_notes: ['LOTO procedure EM-145 required', 'Verify pressure differential < 5 psi before coupon insertion'],
      parts_list: [
        { part_number: 'UT-PM-30MM', description: 'Permanent UT mount 30mm', quantity: 2, in_stock: true },
        { part_number: 'COUP-AFC-1IN', description: 'Corrosion coupon access fitting 1"', quantity: 1, in_stock: true },
        { part_number: 'INH-CI-55GL', description: 'Corrosion inhibitor 55-gallon drum', quantity: 1, in_stock: true },
      ],
      assigned_to: 'Thompson, James (Corrosion Tech)',
      created_at: format(subDays(new Date(), 2), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      updated_at: format(subHours(new Date(), 6), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      due_date: format(subDays(new Date(), -7), 'yyyy-MM-dd'),
      prediction_id: 'PRED-004',
    },
    {
      id: 'WO-2026-1038',
      title: 'Scheduled CP Rectifier Replacement — Mile 180',
      segment_id: 'SEG-019',
      status: 'completed',
      priority: 'medium',
      description: 'Routine replacement of ageing CP rectifier unit at Mile 180. Unit was outputting below specification.',
      repair_procedure: '1. Isolate rectifier from power\n2. Replace with Ferrocast FC-500 unit\n3. Test output and adjust to −1050mV\n4. Update SCADA tag',
      estimated_downtime_hours: 3,
      required_tools: ['Electrician kit', 'Multimeter', 'CP test cables'],
      safety_notes: ['Electrical isolation required', 'Work permit form CP-22'],
      parts_list: [
        { part_number: 'FC500-30A', description: 'Ferrocast FC-500 CP Rectifier 30A', quantity: 1, in_stock: true },
      ],
      assigned_to: 'Nguyen, Sarah (Electrical)',
      created_at: format(subDays(new Date(), 14), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      updated_at: format(subDays(new Date(), 5), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      due_date: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    },
  ];
}

// ─────────────────────────────── Alerts ────────────────────────────────────────

function buildAlerts(): Alert[] {
  return [
    {
      id: 'ALERT-001',
      type: 'leak',
      segment_id: 'SEG-036',
      timestamp: format(subMinutes(new Date(), 8), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      severity: 'critical',
      message: 'Probable hydrocarbon leak detected at Mile 353 by fiber-optic DAS and flow balance. 89% confidence.',
      confidence: 0.89,
      location: { lat: 32.34, lng: -101.05, radius_m: 150 },
      acknowledged: false,
    },
    {
      id: 'ALERT-002',
      type: 'corrosion',
      segment_id: 'SEG-021',
      timestamp: format(subHours(new Date(), 22), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      severity: 'critical',
      message: 'Accelerating external corrosion detected. Wall loss rate 0.18 mm/month. Estimated 14 days to MAOP limit.',
      confidence: 0.87,
      acknowledged: false,
    },
    {
      id: 'ALERT-003',
      type: 'sensor_offline',
      segment_id: 'SEG-012',
      timestamp: format(subHours(new Date(), 48), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      severity: 'warning',
      message: '3 sensors offline at SEG-012 for >4 hours. Likely power supply issue at Mile 115 junction.',
      acknowledged: true,
    },
  ];
}

// ─────────────────────────────── PIG Runs ─────────────────────────────────────

function buildPIGRuns() {
  const run2022 = {
    id: 'PIG-2022-SEG021',
    segment_id: 'SEG-021',
    date: '2022-04-15',
    type: 'MFL',
    vendor: 'TDW PipeScan Pro',
    findings: [
      { mile_marker: 201.3, metal_loss_percent: 12, depth_mm: 1.2, feature_type: 'pit' as const },
      { mile_marker: 203.7, metal_loss_percent: 18, depth_mm: 1.8, feature_type: 'groove' as const },
      { mile_marker: 205.1, metal_loss_percent: 22, depth_mm: 2.3, feature_type: 'pit' as const },
      { mile_marker: 207.4, metal_loss_percent: 9, depth_mm: 0.9, feature_type: 'general' as const },
    ],
  };

  const run2024 = {
    id: 'PIG-2024-SEG021',
    segment_id: 'SEG-021',
    date: '2024-09-20',
    type: 'MFL',
    vendor: 'TDW PipeScan Pro',
    findings: [
      { mile_marker: 201.3, metal_loss_percent: 29, depth_mm: 2.9, feature_type: 'pit' as const },
      { mile_marker: 203.7, metal_loss_percent: 38, depth_mm: 3.9, feature_type: 'groove' as const },
      { mile_marker: 205.1, metal_loss_percent: 48, depth_mm: 4.9, feature_type: 'pit' as const },
      { mile_marker: 207.4, metal_loss_percent: 16, depth_mm: 1.6, feature_type: 'general' as const },
    ],
  };

  return [run2022, run2024];
}

// ─────────────────────────────── Edge Gateways ────────────────────────────────

function buildEdgeGateways() {
  return [
    { id: 'EG-01', location: 'Mile 0 – Wink Station', status: 'online', buffer_pct: 0, last_sync: new Date().toISOString(), sensors_connected: 8 },
    { id: 'EG-02', location: 'Mile 100', status: 'online', buffer_pct: 2, last_sync: format(subMinutes(new Date(), 90), "yyyy-MM-dd'T'HH:mm:ss'Z'"), sensors_connected: 8 },
    { id: 'EG-03', location: 'Mile 200', status: 'online', buffer_pct: 5, last_sync: format(subMinutes(new Date(), 3), "yyyy-MM-dd'T'HH:mm:ss'Z'"), sensors_connected: 8 },
    { id: 'EG-04', location: 'Mile 250', status: 'offline', buffer_pct: 64, last_sync: format(subHours(new Date(), 6), "yyyy-MM-dd'T'HH:mm:ss'Z'"), sensors_connected: 0 },
    { id: 'EG-05', location: 'Mile 350 – Leak Area', status: 'online', buffer_pct: 8, last_sync: format(subMinutes(new Date(), 1), "yyyy-MM-dd'T'HH:mm:ss'Z'"), sensors_connected: 8 },
    { id: 'EG-06', location: 'Mile 500 – Midland Terminal', status: 'online', buffer_pct: 0, last_sync: new Date().toISOString(), sensors_connected: 8 },
  ];
}

// ─────────────────────────────── ROI History ──────────────────────────────────

function buildROIHistory() {
  return [
    { month: 'Jan 2026', downtime_avoided_hours: 12, downtime_value: 540000, emergency_repairs_avoided: 1, emergency_cost_avoided: 380000, planned_savings: 285000, total_roi: 785000 },
    { month: 'Feb 2026', downtime_avoided_hours: 8, downtime_value: 360000, emergency_repairs_avoided: 0, emergency_cost_avoided: 0, planned_savings: 285000, total_roi: 455000 },
    { month: 'Mar 2026', downtime_avoided_hours: 18, downtime_value: 810000, emergency_repairs_avoided: 2, emergency_cost_avoided: 760000, planned_savings: 570000, total_roi: 1485000 },
    { month: 'Apr 2026', downtime_avoided_hours: 6, downtime_value: 270000, emergency_repairs_avoided: 1, emergency_cost_avoided: 380000, planned_savings: 285000, total_roi: 650000 },
    { month: 'May 2026', downtime_avoided_hours: 14, downtime_value: 630000, emergency_repairs_avoided: 1, emergency_cost_avoided: 380000, planned_savings: 285000, total_roi: 935000 },
  ];
}

// ─────────────────────────────── MockDatabase ────────────────────────────────

class MockDatabase {
  segments: PipelineSegment[];
  sensors: Sensor[];
  predictions: PredictionResult[];
  workOrders: WorkOrder[];
  alerts: Alert[];
  pigRuns: ReturnType<typeof buildPIGRuns>;
  edgeGateways: ReturnType<typeof buildEdgeGateways>;
  roiHistory: ReturnType<typeof buildROIHistory>;

  constructor() {
    this.segments = buildSegments();
    this.sensors = buildSensors(this.segments);
    this.predictions = buildPredictions();
    this.workOrders = buildWorkOrders(this.segments);
    this.alerts = buildAlerts();
    this.pigRuns = buildPIGRuns();
    this.edgeGateways = buildEdgeGateways();
    this.roiHistory = buildROIHistory();
    console.log(`✅ MockDatabase initialized: ${this.segments.length} segments, ${this.sensors.length} sensors`);
  }

  getSegments() { return this.segments; }
  getSensors() { return this.sensors; }
  getPredictions() { return this.predictions; }
  getWorkOrders() { return this.workOrders; }
  getAlerts() { return this.alerts; }
  getPIGRuns() { return this.pigRuns; }
  getEdgeGateways() { return this.edgeGateways; }
  getROIHistory() { return this.roiHistory; }

  getSegmentById(id: string) {
    return this.segments.find((s) => s.id === id);
  }

  getSensorsForSegment(segmentId: string) {
    return this.sensors.filter((s) => s.segment_id === segmentId);
  }

  getPredictionForSegment(segmentId: string) {
    return this.predictions.find((p) => p.segment_id === segmentId);
  }

  getActiveAlerts() {
    return this.alerts.filter((a) => !a.acknowledged);
  }

  acknowledgeAlert(alertId: string) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) alert.acknowledged = true;
    return alert;
  }

  createWorkOrder(payload: Partial<WorkOrder>): WorkOrder {
    const wo: WorkOrder = {
      id: `WO-2026-${1050 + this.workOrders.length}`,
      title: payload.title || 'New Work Order',
      segment_id: payload.segment_id || 'SEG-001',
      status: 'draft',
      priority: payload.priority || 'medium',
      description: payload.description || '',
      repair_procedure: payload.repair_procedure || '',
      estimated_downtime_hours: payload.estimated_downtime_hours || 4,
      required_tools: payload.required_tools || [],
      safety_notes: payload.safety_notes || [],
      parts_list: payload.parts_list || [],
      assigned_to: payload.assigned_to || 'Unassigned',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      due_date: payload.due_date || format(subDays(new Date(), -14), 'yyyy-MM-dd'),
      prediction_id: payload.prediction_id,
    };
    this.workOrders.unshift(wo);
    return wo;
  }

  updateWorkOrder(id: string, updates: Partial<WorkOrder>): WorkOrder | null {
    const idx = this.workOrders.findIndex((w) => w.id === id);
    if (idx === -1) return null;
    this.workOrders[idx] = { ...this.workOrders[idx], ...updates, updated_at: new Date().toISOString() };
    return this.workOrders[idx];
  }

  generateLiveSensorReadings(tick: number) {
    const updated = this.sensors.slice(0, 20).map((s) => {
      if (s.status === 'offline') return s;
      const [lo, hi] = s.normal_range;
      const range = hi - lo;
      // Critical-segment sensors trend worse; others random walk
      const seg = this.segments.find((sg) => sg.id === s.segment_id);
      const isCritical = seg?.health_status === 'critical';
      const noise = (Math.random() - 0.5) * range * 0.03;
      const drift = isCritical ? -(range * 0.001) : 0;
      return {
        ...s,
        last_value: +(s.last_value + noise + drift).toFixed(3),
        last_seen: new Date().toISOString(),
      };
    });
    this.sensors.splice(0, updated.length, ...updated);
    return updated;
  }

  generateAnomalyEvent() {
    const criticalPred = this.predictions.filter((p) => p.severity === 'critical');
    if (criticalPred.length === 0) return null;
    const pred = criticalPred[Math.floor(Math.random() * criticalPred.length)];
    return {
      prediction_id: pred.id,
      segment_id: pred.segment_id,
      anomaly_score: pred.anomaly_score + (Math.random() - 0.5) * 0.05,
      timestamp: new Date().toISOString(),
    };
  }

  getROISummary() {
    const total = this.roiHistory.reduce((acc, m) => acc + m.total_roi, 0);
    const downtime = this.roiHistory.reduce((acc, m) => acc + m.downtime_avoided_hours, 0);
    const emergencies = this.roiHistory.reduce((acc, m) => acc + m.emergency_repairs_avoided, 0);
    return {
      total_roi: total,
      downtime_avoided_hours: downtime,
      emergency_repairs_avoided: emergencies,
      months: this.roiHistory.length,
      monthly_history: this.roiHistory,
    };
  }
}

export const mockDatabase = new MockDatabase();
