import React, { useEffect, useMemo, useState } from 'react';
import { apiBaseUrl } from '../../utils/apiBase';


type Protocol = 'MQTT' | 'OPC-UA' | 'Modbus TCP' | 'REST API';




type GatewaySourceType = 'real' | 'simulator';

type ProtocolGatewayStatusRow = {
  protocol: Protocol;
  status_dot_color: string;
  status_label: string; // Active | No recent data | Never connected
  last_success_at: string | null;
  device_counts: Record<GatewaySourceType, number>;
  total_devices: number;
  error_count_24h: number;
  error_log_filter_url?: string;
};

type GatewaysStatusResponse = {
  protocols: ProtocolGatewayStatusRow[];
};

type ProtocolRow = {
  label: Protocol;
  portOrEndpoint: string;
  actionLabel: string;
};

const protocolRows: ProtocolRow[] = [
  {
    label: 'MQTT',
    portOrEndpoint: 'port 1883 / 8883 TLS',
    actionLabel: 'Coming soon',
  },
  {
    label: 'OPC-UA',
    portOrEndpoint: 'port 4840',
    actionLabel: 'Coming soon',
  },
  {
    label: 'Modbus TCP',
    portOrEndpoint: 'port 502',
    actionLabel: 'Coming soon',
  },
  {
    label: 'REST API',
    portOrEndpoint: 'endpoint POST /api/v1/ingest',
    actionLabel: 'View Docs',
  },
];

function formatIsoOrNull(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

const SensorConnectionsCard: React.FC = () => {
  const [statusRows, setStatusRows] = useState<ProtocolGatewayStatusRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadError(null);
        const resp = await fetch(`${apiBaseUrl()}/api/v1/gateways/status`);

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as GatewaysStatusResponse;
        if (!cancelled) setStatusRows(data.protocols);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load');
      }
    }

    load();
    const t = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const statusByProtocol = useMemo(() => {
    const map = new Map<Protocol, ProtocolGatewayStatusRow>();
    (statusRows ?? []).forEach((r) => map.set(r.protocol, r));
    return map;
  }, [statusRows]);

  return (
    <div
      style={{
        background: '#161B24',
        border: '0.5px solid #3B4560',
        borderRadius: '10px',
        padding: '24px',
      }}
    >
      <div style={{ marginBottom: '20px' }}>
        <div style={{ color: '#C8D0DC', fontSize: '15px', fontWeight: 500 }}>Sensor Connections</div>
        <div style={{ color: '#9BA3B2', fontSize: '13px', marginTop: '4px' }}>
          Connect field sensors and edge gateway devices to ReliabilityOS
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {protocolRows.map((row: ProtocolRow) => {
          const s = statusByProtocol.get(row.label);

          const dotColor = s?.status_dot_color ?? '#9BA3B2';
          const statusLabel = s?.status_label ?? 'Loading...';
          const lastSuccess = s?.last_success_at ?? null;
          const lastSuccessFormatted = formatIsoOrNull(lastSuccess);

          const realCount = s?.device_counts?.real ?? 0;
          const simCount = s?.device_counts?.simulator ?? 0;
          const total = realCount + simCount;

          const errorCount = s?.error_count_24h ?? 0;

          return (
            <div
              key={row.label}
              style={{
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '0.5px solid #3B4560',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ color: '#C8D0DC', fontSize: '13px' }}>{row.label}</div>
                <div style={{ color: '#9BA3B2', fontSize: '12px' }}>{row.portOrEndpoint}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    title={lastSuccess ? `Last successful message: ${lastSuccessFormatted}` : 'No successful messages yet'}
                    style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#C8D0DC',
                  }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: dotColor,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: dotColor }}>{statusLabel}</span>
                  </span>

                  {typeof errorCount === 'number' && errorCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const url = s?.error_log_filter_url;
                        if (url) {
                          window.open(url, '_blank');
                        }
                      }}
                      style={{
                        color: '#E5484D',
                        fontSize: '12px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                      title="Open logs filtered to this protocol"
                    >
                      ({errorCount} errors)
                    </button>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#9BA3B2', minWidth: 0 }} />
                  )}
                </div>

                <div style={{ color: '#9BA3B2', fontSize: '12px' }}>
                  {total > 0 ? (
                    <span>
                      {total} gateways · {realCount} real, {simCount} simulated
                    </span>
                  ) : (
                    <span>0 gateways</span>
                  )}
                  {lastSuccessFormatted ? ` · last: ${lastSuccessFormatted}` : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {loadError && (
        <div style={{ marginTop: 12, color: '#FFB020', fontSize: 12 }}>
          Failed to load gateway status: {loadError}
        </div>
      )}

      <button
        type="button"
        style={{
          marginTop: '16px',
          width: 'auto',
          alignSelf: 'flex-start',
          background: '#1E2533',
          border: '0.5px solid #3B4560',
          color: '#C8D0DC',
          fontSize: '13px',
          borderRadius: '8px',
          padding: '8px 16px',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}

        onMouseEnter={(e) => {
          const target: HTMLButtonElement = e.currentTarget;
          target.style.background = '#2A3245';
        }}
        onMouseLeave={(e) => {
          const target: HTMLButtonElement = e.currentTarget;
          target.style.background = '#1E2533';
        }}
        onClick={() => {
          // Open create modal (wired via App-local handler)
          window.dispatchEvent(new CustomEvent('gateway-config-create'));
        }}
      >
        + Register New Gateway
      </button>
    </div>
  );
};

export default SensorConnectionsCard;



