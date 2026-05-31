import type { HealthStatus } from '../types';

export const HEALTH_COLORS: Record<HealthStatus, string> = {
  good:    '#5ABFA5',
  warning: '#D4A24B',
  critical:'#F06A50',

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
  // Severity badge coloring (keeps Critical color constraints)
  switch (sev) {
    case 'critical': return '#F06A50';
    case 'high':     return '#F06A50';
    case 'medium':   return '#D4A24B';
    case 'low':      return '#5ABFA5';
    default:         return '#6B7280';
  }
}


export function priorityColor(p: string): string {
  switch (p) {
    case 'critical': return '#F06A50';
    case 'high':     return '#F06A50';
    case 'medium':   return '#D4A24B';
    case 'low':      return '#5ABFA5';
    default:         return '#6B7280';
  }
}


export function statusColor(s: string): string {
  // UI workflow statuses (keep neutral/dim colors; avoid violating health severity rules)
  switch (s) {
    case 'completed':  return '#5ABFA5';
    case 'in_progress':return '#378ADD';
    case 'pending':    return '#D4A24B';
    case 'draft':      return '#6B7280';
    case 'cancelled':  return '#5A5F66';
    default:           return '#6B7280';
  }
}

