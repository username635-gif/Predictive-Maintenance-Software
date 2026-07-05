import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { GatewayConfig } from '../../types/gateway';

import { useGatewayConfigModalManager } from '../../store/useGatewayConfigModal';





type GatewayListResponse = {

  gateways: GatewayConfig[];
};



type Props = {
  onEditGateway: (gateway: GatewayConfig) => void;
};

function formatIsoOrNull(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

const RegisteredGatewaysList: React.FC<Props> = ({ onEditGateway }) => {
  const [open, setOpen] = useState(true);
  const [gateways, setGateways] = useState<GatewayConfig[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { gatewayRefreshVersion } = useGatewayConfigModalManager();

  useEffect(() => {

    let cancelled = false;



    async function load() {

      try {
        setLoadError(null);
        const resp = await fetch('/api/v1/gateways');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as GatewayListResponse;
        if (!cancelled) setGateways(data.gateways);
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
  }, [gatewayRefreshVersion]);


  const sorted = useMemo(() => {
    const list = gateways ?? [];
    return [...list].sort((a, b) => (a.protocol + a.name).localeCompare(b.protocol + b.name));
  }, [gateways]);

  return (
    <div style={{ marginTop: '14px' }}>
      {/* Modal manager listens for edit events */}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          background: '#1A1C23',
          border: '0.5px solid #3B4560',
          borderRadius: '8px',
          padding: '10px 12px',
          cursor: 'pointer',
          color: '#C8D0DC',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span style={{ fontSize: 13, fontWeight: 700 }}>Registered Gateways</span>
        </span>
        <span style={{ fontSize: 12, color: '#9BA3B2', fontFamily: 'var(--font-mono)' }}>
          {gateways ? gateways.length : '—'}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              border: '0.5px solid #3B4560',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#161B24',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px,1.2fr) 0.9fr 0.8fr 1.1fr 1.0fr 0.7fr',
                gap: 0,
                padding: '10px 12px',
                fontSize: 10,
                color: '#9BA3B2',
                fontWeight: 700,
                background: '#121824',
              }}
            >
              <div>Name</div>
              <div>Protocol</div>
              <div>Source</div>
              <div>Segment assignment</div>
              <div>Last seen</div>
              <div>Status</div>
            </div>

            {loadError && (
              <div style={{ padding: '14px 12px', color: '#FFB020', fontSize: 12 }}>
                Failed to load gateways: {loadError}
              </div>
            )}

            {!loadError && !gateways && (
              <div style={{ padding: '14px 12px', color: '#9BA3B2', fontSize: 12 }}>Loading…</div>
            )}

            {!loadError && gateways && (
              <div>
                {sorted.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      // Open edit modal via event to manager
                      window.dispatchEvent(new CustomEvent('gateway-config-edit', { detail: g }));
                      onEditGateway(g);
                    }}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: 'minmax(140px,1.2fr) 0.9fr 0.8fr 1.1fr 1.0fr 0.7fr',
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: 'none',
                      borderBottom: '0.5px solid #3B4560',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#C8D0DC',
                      alignItems: 'center',
                    }}
                    title="Click to edit this gateway"
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = '#1E2533';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      {g.name}
                      <div style={{ fontSize: 10, color: '#9BA3B2', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{g.id}</div>
                    </div>
                    <div style={{ fontSize: 12 }}>{g.protocol}</div>
                    <div style={{ fontSize: 12, color: '#9BA3B2' }}>{g.source}</div>
                    <div style={{ fontSize: 12, color: '#9BA3B2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.segment_assignment || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: '#9BA3B2' }}>{formatIsoOrNull(g.last_seen_at) || '—'}</div>
                    <div style={{ fontSize: 12 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: 0.2,
                          border: '1px solid rgba(59,69,96,0.8)',
                          background:
                            g.status === 'online'
                              ? 'rgba(90,191,165,0.12)'
                              : g.status === 'degraded'
                                ? 'rgba(255,176,32,0.12)'
                                : 'rgba(155,163,178,0.10)',
                          color:
                            g.status === 'online' ? '#5ABFA5' : g.status === 'degraded' ? '#FFB020' : '#9BA3B2',
                        }}
                      >
                        {g.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisteredGatewaysList;

