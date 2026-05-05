import React from 'react';
import { useStore } from '../../store/useStore';
import { fmtROI } from '../../utils/formatting';
import { timeAgo } from '../../utils/formatting';
import {
  Activity, AlertTriangle, Bell, ChevronDown, Cpu, Wifi, WifiOff,
  BarChart2, FileText, Wrench, Map, Layers
} from 'lucide-react';

interface TopBarProps {
  onOpenROI: () => void;
  onOpenSensors: () => void;
  onOpenWorkOrders: () => void;
  onOpenReport: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenROI, onOpenSensors, onOpenWorkOrders, onOpenReport
}) => {
  const {
    isOffline, connectivity, getActiveAlerts, getTotalROI,
    viewMode, setViewMode, toggleSimulateOffline, pendingSyncCount,
    triggerLeakSimulation, openModal,
  } = useStore();
  const activeAlerts = getActiveAlerts();
  const totalROI = getTotalROI();
  const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;

  return (
    <header style={{
      height: 'var(--topbar-height)',
      background: '#13161F',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '0 16px',
      flexShrink: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
        <Activity size={20} color="#0090FF" />
        <span style={{ fontWeight: 700, fontSize: '15px', color: '#E8ECEF' }}>
          Reliability<span style={{ color: '#0090FF' }}>OS</span>
        </span>
        <span style={{
          fontSize: '10px', color: '#5A6069', background: '#25282B',
          border: '1px solid #2D2D2D', borderRadius: '2px', padding: '1px 5px',
          fontFamily: 'var(--font-mono)'
        }}>PERMIAN 500</span>
      </div>

      <div style={{ width: '1px', height: '28px', background: 'var(--border)', margin: '0 4px' }} />

      {/* View Toggle */}
      <div style={{
        display: 'flex', background: 'var(--bg-panel)', borderRadius: '4px',
        border: '1px solid var(--border)', overflow: 'hidden'
      }}>
        <button
          className="btn btn-sm"
          onClick={() => setViewMode('map')}
          style={{
            borderRadius: 0, border: 'none', gap: '4px', height: '32px',
            background: viewMode === 'map' ? '#0090FF' : 'transparent',
            color: viewMode === 'map' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <Map size={14} /> Map
        </button>
        <button
          className="btn btn-sm"
          onClick={() => setViewMode('longitudinal')}
          style={{
            borderRadius: 0, border: 'none', gap: '4px', height: '32px',
            background: viewMode === 'longitudinal' ? '#0090FF' : 'transparent',
            color: viewMode === 'longitudinal' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <Layers size={14} /> Strip
        </button>
      </div>

      <div style={{ flex: 1 }} />

      {/* ROI Counter */}
      <button
        onClick={onOpenROI}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(48,164,108,0.1)', border: '1px solid rgba(48,164,108,0.25)',
          borderRadius: '4px', padding: '0 12px', height: '36px',
          cursor: 'pointer', color: 'var(--text-primary)',
          transition: 'background 0.15s',
        }}
        title="Click to view ROI breakdown"
      >
        <BarChart2 size={15} color="#30A46C" />
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ROI:</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontWeight: 700,
          fontSize: '16px', color: '#30A46C',
          animation: 'roi-tick 4s ease-in-out infinite'
        }}>
          {fmtROI(totalROI)}
        </span>
        <ChevronDown size={12} color="#6B6E7A" />
      </button>

      {/* Alerts Badge */}
      <button
        onClick={onOpenSensors}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center',
          gap: '6px', padding: '0 12px', height: '36px',
          background: criticalCount > 0 ? 'var(--color-critical-dim)' : 'var(--bg-panel)',
          border: `1px solid ${criticalCount > 0 ? 'rgba(255,65,54,0.35)' : 'var(--border)'}`,
          borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)',
          transition: 'background 0.15s',
        }}
      >
        <Bell size={15} color={criticalCount > 0 ? '#E5484D' : '#858C94'} />
        <span style={{ fontSize: '13px' }}>{activeAlerts.length}</span>
        {criticalCount > 0 && (
          <span className="animate-pulse-red" style={{
            position: 'absolute', top: '-4px', right: '-4px',
            width: '10px', height: '10px', borderRadius: '50%',
            background: '#E5484D', border: '2px solid #1A1C1E',
          }} />
        )}
      </button>

      {/* Edge Gateway Status */}
      <button
        title={`${connectivity.edge_gateways_online}/${connectivity.edge_gateways_total} edge gateways online`}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '0 10px', height: '36px',
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)',
        }}
      >
        <Cpu size={13} />
        <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
          {connectivity.edge_gateways_online}/{connectivity.edge_gateways_total}
        </span>
      </button>

      {/* Nav Buttons */}
      <button className="btn btn-secondary btn-sm" onClick={onOpenWorkOrders} style={{ gap: '5px' }}>
        <Wrench size={13} /> Work Orders
      </button>
      <button className="btn btn-secondary btn-sm" onClick={onOpenReport} style={{ gap: '5px' }}>
        <FileText size={13} /> Reports
      </button>
      <button
        className="btn btn-sm btn-ghost"
        onClick={() => openModal('pig')}
        style={{ gap: '5px', color: 'var(--color-purple)', borderColor: 'rgba(155,83,212,0.35)', fontSize: '11px' }}
        title="Open PIG run comparison tool"
      >
        ◆ PIG Compare
      </button>

      <div style={{ width: '1px', height: '28px', background: 'var(--border)' }} />

      {/* Connectivity indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {isOffline ? (
          <WifiOff size={15} color="var(--color-offline)" />
        ) : (
          <Wifi size={15} color="var(--color-good)" />
        )}
        {!isOffline && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Synced {timeAgo(connectivity.last_sync)}
          </span>
        )}
        {pendingSyncCount > 0 && (
          <span className="badge badge-warning" style={{ fontSize: '10px' }}>
            {pendingSyncCount} pending sync
          </span>
        )}
      </div>

      {/* Dev Controls – Simulate buttons */}
      <div style={{
        display: 'flex', gap: '4px', padding: '0 8px',
        borderLeft: '1px solid var(--border)',
      }}>
        <button
          className={`btn btn-sm ${isOffline ? 'btn-destruct' : 'btn-ghost'}`}
          onClick={toggleSimulateOffline}
          title="Toggle offline simulation"
          style={{ fontSize: '11px', gap: '4px' }}
        >
          {isOffline ? <WifiOff size={12} /> : <WifiOff size={12} />}
          {isOffline ? 'Go Online' : 'Sim Offline'}
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={triggerLeakSimulation}
          title="Trigger simulated leak alert"
          style={{ fontSize: '11px', color: '#E5484D', gap: '4px' }}
        >
          <AlertTriangle size={12} />
          Sim Leak
        </button>
      </div>
    </header>
  );
};
