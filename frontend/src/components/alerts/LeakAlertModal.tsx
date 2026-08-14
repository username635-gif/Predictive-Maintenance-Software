import React from 'react';
import { useStore } from '../../store/useStore';
import { fmt } from '../../utils/formatting';
import { AlertTriangle, X } from 'lucide-react';

// Renamed in effect from "leak alert" to "critical (red-tier) alert" --
// the real schema has no leak/type taxonomy, only tier (red/yellow/green)
// and free-text trigger_summary/recommended_action. This is the closest
// real equivalent to the old fictional 'leak' alert type. location and
// triggering_sensors also do not exist in the real schema and are
// removed rather than faked.
export const LeakAlertModal: React.FC = () => {
  const { alerts, acknowledgeAlert, dismissLeakSimulation, selectSegment } = useStore();
  const criticalAlert = alerts.find(a => a.tier === 'red' && a.status === 'open');
  if (!criticalAlert) return null;

  const handleAcknowledge = async () => {
    await acknowledgeAlert(criticalAlert.id);
    dismissLeakSimulation();
    selectSegment(criticalAlert.asset_id);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,65,54,0.12)', backdropFilter: 'blur(6px)',
      animation: 'fade-in 0.3s ease-out',
    }}>
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

      <div className="animate-fade-in" style={{
        position: 'relative',
        width: '460px', maxWidth: '95vw',
        background: '#1A0808', border: '2px solid #FF4136',
        borderRadius: '8px', padding: '24px',
        boxShadow: 'var(--shadow-glow-red), var(--shadow-lg)',
        zIndex: 1,
      }}>
        <button
          className="btn btn-icon"
          onClick={handleAcknowledge}
          style={{ position: 'absolute', top: '12px', right: '12px', color: '#FF4136' }}
        >
          <X size={16} />
        </button>

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
              CRITICAL ALERT
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#FF7069' }}>
              {criticalAlert.asset_name ?? criticalAlert.asset_id}
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,65,54,0.08)', border: '1px solid rgba(255,65,54,0.25)',
          borderRadius: '6px', padding: '14px', marginBottom: '16px',
        }}>
          <p style={{ fontSize: '13px', color: '#E0E0E0', lineHeight: 1.6, marginBottom: '6px' }}>
            {criticalAlert.trigger_summary}
          </p>
          <p style={{ fontSize: '12px', color: '#FF851B', lineHeight: 1.5, marginBottom: '10px' }}>
            Recommended: {criticalAlert.recommended_action}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Detection Time</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#E0E0E0' }}>
                {fmt(criticalAlert.created_at, 'HH:mm:ss dd MMM')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Confidence</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: '#FF4136' }}>
                {criticalAlert.confidence != null ? `${Math.round(criticalAlert.confidence * 100)}%` : 'n/a'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-destruct"
            onClick={handleAcknowledge}
            style={{ flex: 1, fontWeight: 700, fontSize: '13px' }}
          >
            Acknowledge - Dispatch Response Team
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => selectSegment(criticalAlert.asset_id)}
            style={{ fontSize: '12px' }}
          >
            View on Map
          </button>
        </div>

        <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Alert ID: {criticalAlert.id} - Asset: {criticalAlert.asset_id} - Source: {criticalAlert.source}
        </div>
      </div>
    </div>
  );
};

