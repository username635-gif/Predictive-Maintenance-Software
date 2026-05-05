import type { HealthStatus } from '../types';

export const HEALTH_COLORS: Record<HealthStatus, string> = {
  good:    '#30A46C',
  warning: '#FFD00A',
  critical:'#E5484D',
  unknown: '#5A5F66',
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
    case 'critical': return '#E5484D';
    case 'high':     return '#F76808';
    case 'medium':   return '#FFD00A';
    case 'low':      return '#30A46C';
    default:         return '#5A5F66';
  }
}

export function priorityColor(p: string): string {
  switch (p) {
    case 'critical': return '#E5484D';
    case 'high':     return '#F76808';
    case 'medium':   return '#FFD00A';
    case 'low':      return '#30A46C';
    default:         return '#5A5F66';
  }
}

export function statusColor(s: string): string {
  switch (s) {
    case 'completed':  return '#30A46C';
    case 'in_progress':return '#0090FF';
    case 'pending':    return '#FFD00A';
    case 'draft':      return '#858C94';
    case 'cancelled':  return '#5A5F66';
    default:           return '#595959';
  }
}
