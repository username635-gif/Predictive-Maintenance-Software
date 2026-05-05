import React from 'react';
import { useStore } from '../../store/useStore';
import { sensorTypeLabel, timeAgo } from '../../utils/formatting';
import { X, Activity } from 'lucide-react';

export const SensorHealthModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { sensors } = useStore();

  const online  = sensors.filter(s => s.status === 'online').length;
  const offline = sensors.filter(s => s.status === 'offline').length;
  const degraded= sensors.filter(s => s.status === 'degraded').length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }}>
      <div className="animate-fade-in" style={{
        width: '860px', maxWidth: '95vw', maxHeight: '85vh',
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: '8px', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, background: '#1A1C23',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={16} color="#0078D4" />
            <h2>Sensor Health Dashboard</h2>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {[
              { label: 'Online', count: online, color: '#2ECC40' },
              { label: 'Degraded', count: degraded, color: '#FF851B' },
              { label: 'Offline', count: offline, color: '#FF4136' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{count} {label}</span>
              </div>
            ))}
            <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        {/* Sensor table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#1A1C23', zIndex: 1 }}>
              <tr>
                {['ID', 'Type', 'Mile', 'Segment', 'Last Value', 'Quality', 'Status', 'Last Seen'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left',
                    color: 'var(--text-muted)', fontWeight: 600,
                    borderBottom: '1px solid var(--border)', fontSize: '11px',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensors.map((s, i) => {
                const statusColor = s.status === 'online' ? '#2ECC40' : s.status === 'degraded' ? '#FF851B' : '#FF4136';
                const isOutOfRange = s.last_reading
                  ? (s.last_reading.value < s.normal_range[0] || s.last_reading.value > s.normal_range[1])
                  : false;

                return (
                  <tr
                    key={s.id}
                    style={{
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {s.id}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                      {sensorTypeLabel(s.type)}
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {s.mile_marker}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>
                      {s.segment_id}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontWeight: 600,
                        color: isOutOfRange ? '#FF4136' : 'var(--text-primary)',
                      }}>
                        {s.last_reading?.value.toFixed(2) ?? '–'} {s.unit}
                      </span>
                      {isOutOfRange && (
                        <span style={{ marginLeft: '6px', fontSize: '9px', color: '#FF4136', fontWeight: 700 }}>⚠</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      <span style={{ color: s.last_reading?.quality && s.last_reading.quality > 0.9 ? '#2ECC40' : '#FFDC00' }}>
                        {s.last_reading?.quality ? Math.round(s.last_reading.quality * 100) + '%' : '–'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{
                          width: '6px', height: '6px', borderRadius: '50%', background: statusColor,
                          boxShadow: s.status === 'online' ? `0 0 4px ${statusColor}` : 'none',
                        }} />
                        <span style={{ color: statusColor, fontSize: '11px', fontWeight: 600 }}>
                          {s.status}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', color: s.status === 'offline' ? '#FF4136' : 'var(--text-muted)', fontSize: '11px' }}>
                      {timeAgo(s.last_seen)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
