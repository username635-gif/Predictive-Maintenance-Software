export type GatewaySourceType = 'real' | 'simulator';

export type Protocol = 'MQTT' | 'OPC-UA' | 'Modbus TCP' | 'REST API';

export interface ProtocolGatewayStatusRow {
  protocol: Protocol;
  status_dot_color: string;
  status_label: string; // Active | No recent data | Never connected
  last_success_at: string | null;
  device_counts: Record<GatewaySourceType, number>;
  total_devices: number;
  error_count_24h: number;
  error_log_filter_url?: string;
}

