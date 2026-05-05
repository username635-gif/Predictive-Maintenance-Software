import type { HealthStatus } from '../types';

export const HEALTH_COLORS: Record<HealthStatus, string> = {
  good:    '#2ECC40',
  warning: '#FFDC00',
  critical:'#FF4136',
  unknown: '#595959',
};

export function healthColor(score: number): string {
  if (score >= 70) return HEALTH_COLORS.good;
  if (score >= 40) return HEALTH_COLORS.warning;
  if (score > 0)   return HEALTH_COLORS.critical;
  return HEALTH_COLORS.unknown;
}

export function healthStatusFromScore(score: number): HealthStatus {
  if (score >= 70) return 'good';
  if (score >= 40) return 'warning';
  if (score > 0)   return 'critical';
  return 'unknown';
}

export function severityColor(sev: string): string {
  switch (sev) {
    case 'critical': return '#FF4136';
    case 'high':     return '#FF851B';
    case 'medium':   return '#FFDC00';
    case 'low':      return '#2ECC40';
    default:         return '#595959';
  }
}

export function priorityColor(p: string): string {
  switch (p) {
    case 'critical': return '#FF4136';
    case 'high':     return '#FF851B';
    case 'medium':   return '#FFDC00';
    case 'low':      return '#2ECC40';
    default:         return '#595959';
  }
}

export function statusColor(s: string): string {
  switch (s) {
    case 'completed':  return '#2ECC40';
    case 'in_progress':return '#0078D4';
    case 'pending':    return '#FFDC00';
    case 'draft':      return '#9E9E9E';
    case 'cancelled':  return '#595959';
    default:           return '#595959';
  }
}
