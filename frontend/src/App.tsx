import React, { lazy, Suspense } from 'react';
import { useStore } from './store/useStore';
import { useOfflineDetector } from './hooks/useOffline';
import { useSimulator } from './hooks/useSimulator';
import { TopBar } from './components/layout/TopBar';
import { OfflineBanner } from './components/layout/OfflineBanner';
import { PipelineMap } from './components/map/PipelineMap';
import { LongitudinalView } from './components/longitudinal/LongitudinalView';
import { AssetList } from './components/assets/AssetList';
import { DetailDrawer } from './components/drawer/DetailDrawer';
import { LeakAlertModal } from './components/alerts/LeakAlertModal';

// Lazy-loaded modals
const WorkOrderModal       = lazy(() => import('./components/workorders/WorkOrderModal').then(m => ({ default: m.WorkOrderModal })));
const ROIModal             = lazy(() => import('./components/roi/ROIModal').then(m => ({ default: m.ROIModal })));
const SensorHealthModal    = lazy(() => import('./components/sensors/SensorHealthModal').then(m => ({ default: m.SensorHealthModal })));
const PIGComparisonModal   = lazy(() => import('./components/pig/PIGComparisonModal').then(m => ({ default: m.PIGComparisonModal })));
const ComplianceReportModal= lazy(() => import('./components/reports/ComplianceReportModal').then(m => ({ default: m.ComplianceReportModal })));

const App: React.FC = () => {
  // Global hooks
  useOfflineDetector();
  useSimulator();

  const { viewMode, activeModal, openModal, closeModal, alerts } = useStore();

  const hasUnacknowledgedLeak = alerts.some(a => a.type === 'leak' && !a.acknowledged);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh',
      maxHeight: '100vh',
      width: '100vw',
      maxWidth: '100vw',
      overflow: 'hidden',
      background: 'var(--bg-main)',
    }}>
      {/* ── Top Bar ───────────────────────────────────────────────────────── */}
      <TopBar
        onOpenROI={() => openModal('roi')}
        onOpenSensors={() => openModal('sensors')}
        onOpenWorkOrders={() => openModal('workorders')}
        onOpenReport={() => openModal('report')}
      />

      {/* ── Offline Banner ────────────────────────────────────────────────── */}
      <OfflineBanner />

      {/* ── Main Three-Panel Layout ───────────────────────────────────────── */}
      <div className="app-panels">

        {/* Panel 1 – Primary view: Map or Longitudinal Strip */}
        <div className="panel-map">
          {viewMode === 'map' ? (
            <PipelineMap />
          ) : (
            <LongitudinalView />
          )}

          {viewMode === 'longitudinal' && (
            <div style={{
              position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 50,
              background: 'rgba(26,28,30,0.85)', border: '1px solid var(--border)',
              borderRadius: '4px', padding: '4px 10px', fontSize: '11px',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px',
              pointerEvents: 'none',
            }}>
              Click colour band to select segment · Use brush to zoom
            </div>
          )}
        </div>

        {/* Panel 2 – Asset List */}
        <div className="panel-assets">
          <AssetList />
        </div>

        {/* Panel 3 – Detail Drawer */}
        <div className="panel-drawer">
          <DetailDrawer />
        </div>
      </div>

      {/* ── Modals (lazy-loaded) ──────────────────────────────────────────── */}
      <Suspense fallback={null}>
        {activeModal === 'workorders' && <WorkOrderModal onClose={closeModal} />}
        {activeModal === 'roi'        && <ROIModal onClose={closeModal} />}
        {activeModal === 'sensors'    && <SensorHealthModal onClose={closeModal} />}
        {activeModal === 'pig'        && <PIGComparisonModal onClose={closeModal} />}
        {activeModal === 'report'     && <ComplianceReportModal onClose={closeModal} />}
      </Suspense>

      {/* ── Leak Alert Modal (always visible when active) ─────────────────── */}
      {hasUnacknowledgedLeak && <LeakAlertModal />}
    </div>
  );
};

export default App;
