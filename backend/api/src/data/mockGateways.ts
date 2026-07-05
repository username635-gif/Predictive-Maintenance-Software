import type { GatewayConfig } from '../types/gatewayConfig';
import { format } from 'date-fns';

// In-memory mock gateway configs with edit support.

let gatewayConfigs: GatewayConfig[] = [
  {
    id: 'EG-01',
    name: 'Wink Pump Station',
    protocol: 'MQTT',
    source: 'real',
    segment_assignment: 'SEG-001 to SEG-005',
    last_seen_at: new Date().toISOString(),
    status: 'online',
  },
  {
    id: 'EG-02',
    name: 'Kermit Section',
    protocol: 'MQTT',
    source: 'real',
    segment_assignment: 'SEG-010 to SEG-015',
    last_seen_at: format(new Date(Date.now() - 2 * 60_000), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    status: 'online',
  },
  {
    id: 'EG-03',
    name: 'Crane Junction',
    protocol: 'OPC-UA',
    source: 'real',
    segment_assignment: 'SEG-020 to SEG-025',
    last_seen_at: format(new Date(Date.now() - 1 * 60_000), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    status: 'online',
  },
  {
    id: 'EG-04',
    name: 'Midkiff Valve Site',
    protocol: 'Modbus TCP',
    source: 'real',
    segment_assignment: 'SEG-025 to SEG-030',
    last_seen_at: format(new Date(Date.now() - 6 * 60_000 * 60), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    status: 'offline',
  },
  {
    id: 'EG-05',
    name: 'Garden City Site',
    protocol: 'MQTT',
    source: 'simulator',
    segment_assignment: 'SEG-035 to SEG-040',
    last_seen_at: format(new Date(Date.now() - 1 * 60_000), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    status: 'online',
  },
  {
    id: 'EG-06',
    name: 'Midland Terminal',
    protocol: 'Modbus TCP',
    source: 'real',
    segment_assignment: 'SEG-045 to SEG-050',
    last_seen_at: new Date().toISOString(),
    status: 'online',
  },
];

export function getGatewayConfigs(): GatewayConfig[] {
  return gatewayConfigs;
}

export function updateGatewayConfig(gatewayId: string, updates: Partial<GatewayConfig>): GatewayConfig | null {
  const idx = gatewayConfigs.findIndex((g) => g.id === gatewayId);
  if (idx === -1) return null;

  const current = gatewayConfigs[idx];

  const next: GatewayConfig = {
    ...current,
    ...updates,
    id: current.id, // do not allow changing id
    name: typeof updates.name === 'string' ? updates.name : current.name,
    segment_assignment:
      typeof (updates as any).segment_assignment === 'string' ? (updates as any).segment_assignment : current.segment_assignment,
    last_seen_at:
      typeof (updates as any).last_seen_at === 'string' || (updates as any).last_seen_at === null
        ? (updates as any).last_seen_at
        : current.last_seen_at,
  };

  gatewayConfigs[idx] = next;
  return next;
}

