import React from 'react';
import { useStore } from '../../store/useStore';
import { sensorTypeLabel, timeAgo } from '../../utils/formatting';
import { X, Activity } from 'lucide-react';

// Rebuilt against the real Sensor shape. status is only online/offline in
// the real schema -- 'degraded' has no backing signal yet (the backend's
// own /sensors/health/summary route says as much: "not yet implemented").
// normal_range/last_reading/mile_marker/segment_id/type do not exist;
// using hard_min/hard_max (or manual_override when set), last_value,
// asset_id/asset_name, sensor_type instead. No reading-quality metric
// exists at all -- that column is dropped from the table rather than
// faked.
export const SensorHealthModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { sensors } = useStore();

  const online = sensors.filter(s => s.status === 'online').length;
  const offline = sensors.filter(s => s.status === 'offline').length;

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

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#1A1C23', zIndex: 1 }}>
              <tr>
                {['ID', 'Type', 'Asset', 'Last Value', 'Normal Range', 'Status', 'Last Seen'].map(h => (
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
                const statusColor = s.status === 'online' ? '#2ECC40' : '#FF4136';
                const rangeMin = s.manual_override_min ?? s.hard_min;
                const rangeMax = s.manual_override_max ?? s.hard_max;
                const isOutOfRange =
                  s.last_value !== null && rangeMin !== null && rangeMax !== null
                    ? s.last_value < rangeMin || s.last_value > rangeMax
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
                      {sensorTypeLabel(s.sensor_type)}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>
                      {s.asset_name ?? s.asset_id}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontWeight: 600,
                        color: isOutOfRange ? '#FF4136' : 'var(--text-primary)',
                      }}>
                        {s.last_value !== null ? s.last_value.toFixed(2) : '-'} {s.unit}
                      </span>
                      {isOutOfRange && (
                        <span style={{ marginLeft: '6px', fontSize: '9px', color: '#FF4136', fontWeight: 700 }}>!</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {rangeMin !== null && rangeMax !== null ? `${rangeMin}-${rangeMax}` : 'not set'}
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
                      {s.last_seen ? timeAgo(s.last_seen) : 'never'}
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
