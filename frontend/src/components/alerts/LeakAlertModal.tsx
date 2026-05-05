import React from 'react';
import { useStore } from '../../store/useStore';
import { fmt } from '../../utils/formatting';
import { AlertTriangle, X, Radio } from 'lucide-react';

export const LeakAlertModal: React.FC = () => {
  const { alerts, acknowledgeAlert, dismissLeakSimulation, selectSegment } = useStore();
  const leak = alerts.find(a => a.type === 'leak' && !a.acknowledged);
  if (!leak) return null;

  const handleAcknowledge = () => {
    acknowledgeAlert(leak.id);
    dismissLeakSimulation();
    selectSegment(leak.segment_id);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,65,54,0.12)', backdropFilter: 'blur(6px)',
      animation: 'fade-in 0.3s ease-out',
    }}>
      {/* Pulsing ring */}
      <div style={{
        position: 'absolute',
        width: '380px', height: '380px',
        borderRadius: '50%',
        border: '2px solid rgba(255,65,54,0.3)',
        animation: 'pulse-red 2s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute',
        width: '280px', height: '280px',
        borderRadius: '50%',
        border: '2px solid rgba(255,65,54,0.5)',
        animation: 'pulse-red 2s ease-in-out infinite',
        animationDelay: '0.5s',
      }} />

      {/* Alert card */}
      <div className="animate-fade-in" style={{
        position: 'relative',
        width: '460px', maxWidth: '95vw',
        background: '#1A0808', border: '2px solid #FF4136',
        borderRadius: '8px', padding: '24px',
        boxShadow: 'var(--shadow-glow-red), var(--shadow-lg)',
        zIndex: 1,
      }}>
        {/* Dismiss */}
        <button
          className="btn btn-icon"
          onClick={handleAcknowledge}
          style={{ position: 'absolute', top: '12px', right: '12px', color: '#FF4136' }}
        >
          <X size={16} />
        </button>

        {/* Icon row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div className="animate-pulse-red" style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(255,65,54,0.2)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <AlertTriangle size={24} color="#FF4136" />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#FF4136', fontWeight: 700, letterSpacing: '1px' }}>
              ● CRITICAL ALERT
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#FF7069' }}>
              ACTIVE LEAK DETECTED
            </div>
          </div>
        </div>

        {/* Alert body */}
        <div style={{
          background: 'rgba(255,65,54,0.08)', border: '1px solid rgba(255,65,54,0.25)',
          borderRadius: '6px', padding: '14px', marginBottom: '16px',
        }}>
          <p style={{ fontSize: '13px', color: '#E0E0E0', lineHeight: 1.6, marginBottom: '10px' }}>
            {leak.message}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Detection Time</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#E0E0E0' }}>
                {fmt(leak.timestamp, 'HH:mm:ss dd MMM')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Confidence</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: '#FF4136' }}>
                {Math.round(leak.confidence * 100)}%
              </div>
            </div>
            {leak.location && (
              <>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Estimated Location</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#E0E0E0' }}>
                    {leak.location.lat.toFixed(4)}° N, {leak.location.lng.toFixed(4)}° W
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Location Uncertainty</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#FFDC00' }}>
                    ±{leak.location.radius_m}m
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Triggering sensors */}
        {leak.triggering_sensors.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              TRIGGERING SENSORS
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {leak.triggering_sensors.map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Radio size={10} color="#FF851B" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#FF851B', background: 'rgba(255,133,27,0.1)', padding: '2px 6px', borderRadius: '3px' }}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-destruct"
            onClick={handleAcknowledge}
            style={{ flex: 1, fontWeight: 700, fontSize: '13px' }}
          >
            ✓ Acknowledge – Dispatch Response Team
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => selectSegment(leak.segment_id)}
            style={{ fontSize: '12px' }}
          >
            View on Map
          </button>
        </div>

        <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Alert ID: {leak.id} · Segment: {leak.segment_id} · Fusion model v2.4.1
        </div>
      </div>
    </div>
  );
};
