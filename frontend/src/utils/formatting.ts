import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function fmt(iso: string, pattern = 'dd MMM yyyy HH:mm'): string {
  try { return format(parseISO(iso), pattern); }
  catch { return iso; }
}

export function timeAgo(iso: string): string {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }); }
  catch { return iso; }
}

export function fmtCurrency(n: number, currency = 'USD'): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

export function fmtROI(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function fmtPercent(n: number, decimals = 0): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function fmtSensorValue(value: number, unit: string): string {
  return `${value.toFixed(unit === 'mm' ? 2 : 1)} ${unit}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

export function sensorTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    ultrasonic_thickness:   'Ultrasonic Gauge',
    acoustic_emission:      'Acoustic Emission',
    pressure_transmitter:   'Pressure Tx',
    flow_meter:             'Flow Meter',
    cathodic_protection:    'Cathodic Protection',
    fiber_optic_das:        'Fiber Optic DAS',
    vibration_accelerometer:'Vibration (IEPE)',
  };
  return labels[type] ?? type;
}
