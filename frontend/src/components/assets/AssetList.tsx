import React from 'react';
import { useStore } from '../../store/useStore';
import { healthColor } from '../../utils/colors';
import { AlertTriangle, CheckCircle, Clock, ChevronRight } from 'lucide-react';

function healthIcon(status: string, size = 14): React.ReactNode {
  if (status === 'critical') return <AlertTriangle size={size} color="#E5484D" />;
  if (status === 'warning')  return <AlertTriangle size={size} color="#FFD00A" />;
  return <CheckCircle size={size} color="#30A46C" />;
}

export const AssetList: React.FC = () => {
  const { segments, selectedSegmentId, selectSegment, getPredictionForSegment, alerts } = useStore();

  // Sort: critical first, then warning, then good; within same status sort by RUL ascending
  const sorted = [...segments].sort((a, b) => {
    const order = { critical: 0, warning: 1, good: 2, unknown: 3 };
    const ao = order[a.health_status];
    const bo = order[b.health_status];
    if (ao !== bo) return ao - bo;
    return a.health_score - b.health_score;
  });

  const activeAlerts = alerts.filter(a => !a.acknowledged);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, background: '#1A1C23',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Pipeline Assets</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{segments.length} segments</span>
        </div>
        {/* Summary row */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          {[
            { label: 'Critical', count: segments.filter(s => s.health_status === 'critical').length, color: '#E5484D' },
            { label: 'Warning',  count: segments.filter(s => s.health_status === 'warning').length,  color: '#FFD00A' },
            { label: 'Good',     count: segments.filter(s => s.health_status === 'good').length,     color: '#30A46C' },
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

      {/* Active alert strip */}
      {activeAlerts.length > 0 && (
        <div style={{
          padding: '6px 12px', background: 'rgba(229,72,77,0.1)',
          borderBottom: '1px solid rgba(229,72,77,0.25)', flexShrink: 0,
        }}>
          <div style={{ fontSize: '11px', color: '#E5484D', fontWeight: 600, marginBottom: '4px' }}>
            ● {activeAlerts.length} ACTIVE ALERT{activeAlerts.length > 1 ? 'S' : ''}
          </div>
          {activeAlerts.slice(0, 2).map(a => (
            <button
              key={a.id}
              onClick={() => selectSegment(a.segment_id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: '11px', padding: '2px 0',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              → {a.message.substring(0, 60)}…
            </button>
          ))}
        </div>
      )}

      {/* Segment list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.map(seg => {
          const pred = getPredictionForSegment(seg.id);
          const isSelected = selectedSegmentId === seg.id;
          const color = healthColor(seg.health_score);
          const segAlerts = activeAlerts.filter(a => a.segment_id === seg.id);

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
              {/* Health icon */}
              <div style={{ flexShrink: 0 }}>
                {healthIcon(seg.health_status)}
              </div>

              {/* Main Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  Mi {seg.mile_start}–{seg.mile_end}
                  {segAlerts.length > 0 && (
                    <span className="animate-pulse-red" style={{
                      marginLeft: '6px', width: '6px', height: '6px',
                      display: 'inline-block', borderRadius: '50%', background: '#E5484D',
                    }} />
                  )}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {seg.sensors.length} sensors · {seg.diameter_inches}" · {seg.material}
                </div>
              </div>

              {/* Score + RUL */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color }}>
                  {seg.health_score}%
                </div>
                <div style={{ fontSize: '10px', color: pred?.severity === 'critical' ? '#E5484D' : 'var(--text-muted)' }}>
                  {pred ? (
                    pred.rul_days === 0 ? 'ACTIVE' : `${pred.rul_days}d RUL`
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>–</span>
                  )}
                </div>
              </div>

              <ChevronRight size={12} color={isSelected ? 'var(--color-info)' : 'var(--border-light)'} style={{ flexShrink: 0 }} />
            </button>
          );
        })}

        {/* Empty state */}
        {sorted.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
            <div>All segments within normal parameters.</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>Next scheduled PIG run: 14 days.</div>
          </div>
        )}
      </div>

      {/* Footer: last updated */}
      <div style={{
        padding: '6px 12px', borderTop: '1px solid var(--border)',
        flexShrink: 0, background: '#131720',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-muted)' }}>
          <Clock size={10} />
          Live · updating every 2s
        </div>
      </div>
    </div>
  );
};
