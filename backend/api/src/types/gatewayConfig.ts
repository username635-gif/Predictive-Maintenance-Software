export type GatewayProtocol = 'MQTT' | 'OPC-UA' | 'Modbus TCP' | 'REST API';
export type GatewaySourceType = 'real' | 'simulator';

export type GatewayStatus = 'online' | 'offline' | 'degraded';

export interface GatewayConfig {
  id: string;
  name: string;
  protocol: GatewayProtocol;
  source: GatewaySourceType; // real/simulated
  segment_assignment: string;
  last_seen_at: string | null;
  status: GatewayStatus;
}

