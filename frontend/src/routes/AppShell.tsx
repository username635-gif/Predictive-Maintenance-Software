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
import { useSimulator } from '../hooks/useSimulator';

import { useNavigate } from 'react-router-dom';
import { clearRosSession } from '../auth/rosSession';
import { Suspense, lazy } from 'react';

const WorkOrderModal = lazy(() => import('../components/workorders/WorkOrderModal').then(m => ({ default: m.WorkOrderModal })));
const ROIModal = lazy(() => import('../components/roi/ROIModal').then(m => ({ default: m.ROIModal })));
const SensorHealthModal = lazy(() => import('../components/sensors/SensorHealthModal').then(m => ({ default: m.SensorHealthModal })));
const PIGComparisonModal = lazy(() => import('../components/pig/PIGComparisonModal').then(m => ({ default: m.PIGComparisonModal })));
const ComplianceReportModal = lazy(() => import('../components/reports/ComplianceReportModal').then(m => ({ default: m.ComplianceReportModal })));

export const AppShell: React.FC = () => {
  const navigate = useNavigate();

  // Global hooks
  useOfflineDetector();

  const demoMode = String((import.meta as any).env?.VITE_DEMO_MODE) === 'true';
  if (demoMode) {
    useSimulator();
  }


  const { viewMode, activeModal, openModal, closeModal, alerts } = useStore();
  const hasUnacknowledgedLeak = alerts.some(a => a.type === 'leak' && !a.acknowledged);

  const onSignOut = () => {
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
          onOpenWorkOrders={() => openModal('workorders')}
          onOpenReport={() => openModal('report')}
          onSignOut={onSignOut}
        />
      </div>


      <OfflineBanner />

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
              Click colour band to select segment · Use brush to zoom
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
      </Suspense>

      {/* Gateway config modal manager (wired to gateway-config-create/edit events) */}
      <GatewayConfigGatewayModalManager />

      {hasUnacknowledgedLeak && <LeakAlertModal />}
    </div>
  );
};


