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
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Panel 1 – Primary view: Map or Longitudinal Strip (70%) */}
        <div style={{
          flex: '0 0 70%', minWidth: 0,
          borderRight: '1px solid var(--border)',
          position: 'relative',
          overflow: 'hidden',
          isolation: 'isolate',
        }}>
          {viewMode === 'map' ? (
            <PipelineMap />
          ) : (
            <LongitudinalView />
          )}

          {/* View toggle floating hint for longitudinal */}
          {viewMode === 'longitudinal' && (
            <div style={{
              position: 'absolute', top: '12px', right: '12px', zIndex: 50,
              background: 'rgba(19,22,31,0.9)', border: '1px solid var(--border)',
              borderRadius: '4px', padding: '6px 10px', fontSize: '11px',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              Click colour band to select segment · Use brush to zoom
            </div>
          )}
        </div>

        {/* Panel 2 – Asset List (20%) */}
        <div style={{
          flex: '0 0 20%', minWidth: 0,
          borderRight: '1px solid var(--border)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          isolation: 'isolate',
        }}>
          <AssetList />
        </div>

        {/* Panel 3 – Detail Drawer (10%) */}
        <div style={{
          flex: '0 0 10%',
          minWidth: 0,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          transition: 'flex-basis 0.25s ease',
        }}>
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

      {/* ── PIG Comparison shortcut (floating button) ─────────────────────── */}
      <button
        onClick={() => openModal('pig')}
        style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 50,
          background: 'rgba(155,83,212,0.15)', border: '1px solid rgba(155,83,212,0.4)',
          borderRadius: '4px', padding: '0 14px', height: '36px',
          cursor: 'pointer', color: '#9B53D4', fontSize: '12px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '6px',
          transition: 'background 0.15s',
        }}
        title="Open PIG run comparison tool"
      >
        ◆ PIG Comparison
      </button>
    </div>
  );
};

export default App;
