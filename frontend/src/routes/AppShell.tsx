import React from 'react';
import { TopBar } from '../components/layout/TopBar';
import { OfflineBanner } from '../components/layout/OfflineBanner';
import { PipelineMap } from '../components/map/PipelineMap';
import { LongitudinalView } from '../components/longitudinal/LongitudinalView';
import { AssetList } from '../components/assets/AssetList';
import { DetailDrawer } from '../components/drawer/DetailDrawer';
import { LeakAlertModal } from '../components/alerts/LeakAlertModal';
import GatewayConfigGatewayModalManager from '../components/gateways/GatewayConfigGatewayModalManager';

import { useStore } from '../store/useStore';
import { useOfflineDetector } from '../hooks/useOffline';
import { connectSocket, disconnectSocket } from '../services/socket';

import { useNavigate } from 'react-router-dom';
import { clearRosSession, getRosSession } from '../auth/rosSession';
import { Suspense, lazy, useEffect, useState } from 'react';

const WorkOrderModal = lazy(() => import('../components/workorders/WorkOrderModal').then(m => ({ default: m.WorkOrderModal })));
const ROIModal = lazy(() => import('../components/roi/ROIModal').then(m => ({ default: m.ROIModal })));
const SensorHealthModal = lazy(() => import('../components/sensors/SensorHealthModal').then(m => ({ default: m.SensorHealthModal })));
const PIGComparisonModal = lazy(() => import('../components/pig/PIGComparisonModal').then(m => ({ default: m.PIGComparisonModal })));
const ComplianceReportModal = lazy(() => import('../components/reports/ComplianceReportModal').then(m => ({ default: m.ComplianceReportModal })));
const GatewaysModal = lazy(() => import('../components/gateways/GatewaysModal').then(m => ({ default: m.GatewaysModal })));
const InviteModal = lazy(() => import('../components/admin/InviteModal').then(m => ({ default: m.InviteModal })));
const ImportModal = lazy(() => import('../components/admin/ImportModal').then(m => ({ default: m.ImportModal })));

export const AppShell: React.FC = () => {
  const navigate = useNavigate();

  // Global hooks
  useOfflineDetector();

  const demoMode = String((import.meta as any).env?.VITE_DEMO_MODE) === 'true';
  if (demoMode) {

  }

  const isAdmin = getRosSession()?.user?.role === 'admin';

  const {
    viewMode, activeModal, openModal, closeModal, alerts,
    applyStateInit, mergeActiveAlerts, mergeWorkOrderCreated, mergeAlertAcknowledged,
  } = useStore();
  const hasUnacknowledgedLeak = alerts.some(a => a.type === 'leak' && !a.acknowledged);
  const [socketError, setSocketError] = useState<string | null>(null);

  // Real-time Socket.IO connection. Read-only by design -- see
  // services/socket.ts JSDoc: work order creation and alert acknowledgment
  // stay on the REST calls in useStore (api.createWorkOrder / api.acknowledgeAlert)
  // to avoid the dual-write path found during the Socket.IO audit. This effect
  // only ever registers *incoming* handlers, never emits a write.
  useEffect(() => {
    connectSocket({
      onStateInit: (payload) => { applyStateInit(payload); setSocketError(null); },
      onActiveAlerts: (alerts) => mergeActiveAlerts(alerts),
      onWorkOrderCreated: (wo) => mergeWorkOrderCreated(wo),
      onAlertAcknowledged: (alert) => mergeAlertAcknowledged(alert),
      onConnectError: (message) => { console.error('[socket] connect error:', message); setSocketError(message); },
    });

    return () => {
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    const onSessionExpired = () => {
      disconnectSocket();
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth-session-expired' as any, onSessionExpired);
    return () => {
      window.removeEventListener('auth-session-expired' as any, onSessionExpired);
    };
  }, [navigate]);

  const onSignOut = () => {
    disconnectSocket();
    clearRosSession();
    navigate('/login', { replace: true });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        maxWidth: '100vw',
        overflow: 'hidden',
        background: 'var(--bg-main)',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <TopBar
          onOpenROI={() => openModal('roi')}
          onOpenSensors={() => openModal('sensors')}
          onOpenGateways={() => openModal('gateways')}
          onOpenWorkOrders={() => openModal('workorders')}
          onOpenReport={() => openModal('report')}
          onOpenInvite={isAdmin ? () => openModal('invite') : undefined}
          onOpenImport={isAdmin ? () => openModal('import') : undefined}
          onSignOut={onSignOut}
        />
      </div>


      <OfflineBanner />
      {socketError && (
        <div style={{ height: 32, background: 'rgba(240,106,80,0.12)', borderBottom: '1px solid rgba(240,106,80,0.3)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', flexShrink: 0, fontSize: 12, color: '#F06A50' }}>
          Real-time connection lost — retrying in background. Data may be stale.
        </div>
      )}

      <div className="app-panels">
        <div className="panel-map">
          {viewMode === 'map' ? <PipelineMap /> : <LongitudinalView />}
          {viewMode === 'longitudinal' && (
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 50,
                background: 'rgba(26,28,30,0.85)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '11px',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                pointerEvents: 'none',
              }}
            >
              Click colour band to select segment Â· Use brush to zoom
            </div>
          )}
        </div>

        <div className="panel-assets">
          <AssetList />
        </div>

        <div className="panel-drawer">
          <DetailDrawer />
        </div>
      </div>

      <Suspense fallback={null}>
        {activeModal === 'workorders' && <WorkOrderModal onClose={closeModal} />}
        {activeModal === 'roi' && <ROIModal onClose={closeModal} />}
        {activeModal === 'sensors' && <SensorHealthModal onClose={closeModal} />}
        {activeModal === 'pig' && <PIGComparisonModal onClose={closeModal} />}
        {activeModal === 'report' && <ComplianceReportModal onClose={closeModal} />}
        {activeModal === 'gateways' && <GatewaysModal onClose={closeModal} />}
        {activeModal === 'invite' && <InviteModal onClose={closeModal} />}
        {activeModal === 'import' && <ImportModal onClose={closeModal} />}
      </Suspense>

      {/* Gateway config modal manager (wired to gateway-config-create/edit events) */}
      <GatewayConfigGatewayModalManager />

      {hasUnacknowledgedLeak && <LeakAlertModal />}
    </div>
  );
};
