import React from 'react';
import { useStore } from '../../store/useStore';
import { X, Cpu } from 'lucide-react';
import SensorConnectionsCard from '../sensors/SensorConnectionsCard';
import RegisteredGatewaysList from './RegisteredGatewaysList';

export const GatewaysModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { connectivity } = useStore();

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
            <Cpu size={16} color="#0078D4" />
            <h2>Edge Gateways</h2>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Gateways:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{connectivity.edge_gateways_online}/{connectivity.edge_gateways_total}</span>
            </div>
            <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SensorConnectionsCard />
          <RegisteredGatewaysList onEditGateway={() => {}} />
        </div>
      </div>
    </div>
  );
};

export default GatewaysModal;
