import React from 'react';
import { WifiOff, RefreshCw, Clock } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { timeAgo } from '../../utils/formatting';

export const OfflineBanner: React.FC = () => {
  const { isOffline, connectivity, pendingSyncCount, syncOfflineQueue } = useStore();

  if (!isOffline) return null;

  return (
    <div
      className="animate-fade-in"
      style={{
        height: 'var(--banner-height)',
        background: '#2A2A2A',
        borderBottom: '1px solid var(--color-offline)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 16px',
        flexShrink: 0,
        zIndex: 99,
      }}
    >
      <WifiOff size={14} color="var(--color-offline)" />

      <span style={{ color: '#C0C0C0', fontWeight: 600, fontSize: '13px' }}>
        OFFLINE MODE
      </span>

      <div style={{ height: '14px', width: '1px', background: '#444' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)', fontSize: '12px' }}>
        <Clock size={12} />
        <span>Showing data from {timeAgo(connectivity.last_sync)}</span>
      </div>

      <div style={{ height: '14px', width: '1px', background: '#444' }} />

      <span style={{ fontSize: '12px', color: '#A0A0A0' }}>
        Edge monitoring is still active — critical alarms will trigger locally
      </span>


      <div style={{ flex: 1 }} />

      {pendingSyncCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            background: 'rgba(255,220,0,0.15)', border: '1px solid rgba(255,220,0,0.35)',
            borderRadius: '3px', padding: '2px 8px', fontSize: '11px', color: '#FFD00A',
          }}>
            {pendingSyncCount} work order{pendingSyncCount > 1 ? 's' : ''} queued
          </span>
          <button
            className="btn btn-sm btn-secondary"
            onClick={syncOfflineQueue}
            style={{ gap: '4px', fontSize: '11px' }}
            title="Manually retry sync (auto-syncs when online)"
          >
            <RefreshCw size={11} className="animate-spin" /> Retry Sync
          </button>
        </div>
      )}

      <span style={{
        fontSize: '11px', color: 'var(--text-muted)',
        background: 'rgba(89,89,89,0.2)', borderRadius: '2px', padding: '2px 6px',
      }}>
        Edge buffer: {connectivity.offline_buffer_pct}% full
      </span>
    </div>
  );
};
