import React from 'react';
import { useStore } from '../../store/useStore';
import { healthColor } from '../../utils/colors';
import { AlertTriangle, CheckCircle, Clock, ChevronRight } from 'lucide-react';

function healthIcon(zone: string | null, size = 14): React.ReactNode {
  if (zone === 'critical') return <AlertTriangle size={size} color="#E5484D" />;
  if (zone === 'warning')  return <AlertTriangle size={size} color="#FFD00A" />;
  return <CheckCircle size={size} color="#30A46C" />;
}

export const AssetList: React.FC = () => {
  const { segments, selectedSegmentId, selectSegment, getPredictionForSegment, getSensorsForSegment, alerts } = useStore();

  // Sorted by real zone (seeded label), then by real health_score ascending.
  // health_status/mile_start/mile_end do not exist in the real schema.
  const sorted = [...segments].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, good: 2 };
    const ao = order[a.zone ?? ''] ?? 3;
    const bo = order[b.zone ?? ''] ?? 3;
    if (ao !== bo) return ao - bo;
    return (a.health_score ?? 100) - (b.health_score ?? 100);
  });

  // Real status values: open/acknowledged/escalated/resolved -- no boolean
  // `acknowledged` field exists. "Active" means still needing attention.
  const activeAlerts = alerts.filter(a => a.status === 'open' || a.status === 'escalated');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, background: '#1A1C23',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Pipeline Assets</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{segments.length} segments</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          {[
            { label: 'Critical', count: segments.filter(s => s.zone === 'critical').length, color: '#E5484D' },
            { label: 'Warning',  count: segments.filter(s => s.zone === 'warning').length,  color: '#FFD00A' },
            { label: 'Good',     count: segments.filter(s => s.zone === 'good').length,     color: '#30A46C' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{
              flex: 1, textAlign: 'center',
              background: `${color}14`,
              border: `1px solid ${color}30`,
              borderRadius: '4px', padding: '4px 4px',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color }}>{count}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {activeAlerts.length > 0 && (
        <div style={{
          padding: '6px 12px', background: 'rgba(229,72,77,0.1)',
          borderBottom: '1px solid rgba(229,72,77,0.25)', flexShrink: 0,
        }}>
          <div style={{ fontSize: '11px', color: '#E5484D', fontWeight: 600, marginBottom: '4px' }}>
            {activeAlerts.length} ACTIVE ALERT{activeAlerts.length > 1 ? 'S' : ''}
          </div>
          {activeAlerts.slice(0, 2).map(a => (
            <button
              key={a.id}
              onClick={() => selectSegment(a.asset_id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: '11px', padding: '2px 0',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              -&gt; {a.trigger_summary.substring(0, 60)}...
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.map(seg => {
          const pred = getPredictionForSegment(seg.id);
          const isSelected = selectedSegmentId === seg.id;
          const color = healthColor(seg.health_score ?? 100);
          const segAlerts = activeAlerts.filter(a => a.asset_id === seg.id);
          const sensorCount = getSensorsForSegment(seg.id).length;

          return (
            <button
              key={seg.id}
              onClick={() => selectSegment(isSelected ? null : seg.id)}
              style={{
                display: 'flex', width: '100%', textAlign: 'left',
                padding: '8px 12px', gap: '10px',
                background: isSelected ? '#2A2D36' : 'transparent',
                border: 'none', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', alignItems: 'center',
                borderLeft: `3px solid ${color}`,
                transition: 'background 0.12s',
              }}
            >
              <div style={{ flexShrink: 0 }}>
                {healthIcon(seg.zone)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {seg.name}
                  {segAlerts.length > 0 && (
                    <span className="animate-pulse-red" style={{
                      marginLeft: '6px', width: '6px', height: '6px',
                      display: 'inline-block', borderRadius: '50%', background: '#E5484D',
                    }} />
                  )}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {sensorCount} sensor{sensorCount === 1 ? '' : 's'} - {seg.platform}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color }}>
                  {seg.health_score ?? '-'}%
                </div>
                <div style={{ fontSize: '10px', color: pred?.severity === 'critical' ? '#E5484D' : 'var(--text-muted)' }}>
                  {pred ? (
                    pred.rul_days === 0 ? 'ACTIVE' : pred.rul_days != null ? `${pred.rul_days}d RUL` : '-'
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                  )}
                </div>
              </div>

              <ChevronRight size={12} color={isSelected ? 'var(--color-info)' : 'var(--border-light)'} style={{ flexShrink: 0 }} />
            </button>
          );
        })}

        {sorted.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
            <div>No segments loaded.</div>
          </div>
        )}
      </div>

      <div style={{
        padding: '6px 12px', borderTop: '1px solid var(--border)',
        flexShrink: 0, background: '#131720',
      }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '10px',
            color: 'var(--text-muted)',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={10} />
            Live
          </div>

          {String((import.meta as any).env?.VITE_DEMO_MODE) === 'true' && (
            <div
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid rgba(212, 162, 75, 0.45)',
                background: 'rgba(212, 162, 75, 0.14)',
                color: '#FFD00A',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}
              title="Demo mode is enabled"
            >
              DEMO MODE - synthetic data
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
