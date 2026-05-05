import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { healthColor } from '../../utils/colors';
import { fmt } from '../../utils/formatting';
import { PredictionCard } from '../predictions/PredictionCard';
import { SensorSparkline } from './SensorSparklines';
import { X, ChevronLeft, AlertTriangle, Thermometer, Activity, Clock } from 'lucide-react';

export const DetailDrawer: React.FC = () => {
  const {
    selectedSegmentId, selectSegment, drawerOpen,
    getSegmentById, getPredictionForSegment, getSensorsForSegment,
    createWorkOrder, workOrders, isOffline, queueOfflineWorkOrder,
  } = useStore();
  const [tab, setTab] = useState<'overview' | 'sensors' | 'workorders'>('overview');

  const segment = selectedSegmentId ? getSegmentById(selectedSegmentId) : null;
  const prediction = selectedSegmentId ? getPredictionForSegment(selectedSegmentId) : undefined;
  const sensors = selectedSegmentId ? getSensorsForSegment(selectedSegmentId) : [];
  const segWorkOrders = workOrders.filter(wo => wo.segment_id === selectedSegmentId);

  if (!segment || !drawerOpen) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%',
        color: 'var(--text-muted)', gap: '8px', padding: '16px',
      }}>
        <ChevronLeft size={24} opacity={0.3} />
        <p style={{ fontSize: '11px', textAlign: 'center', lineHeight: 1.5 }}>
          Select a pipeline segment to view details
        </p>
      </div>
    );
  }

  const color = healthColor(segment.health_score);

  const handleCreateWO = () => {
    const wo = createWorkOrder({
      title: `Inspection: ${segment.name}`,
      segment_id: segment.id,
      asset_id: segment.id,
      priority: prediction?.severity as 'critical' | 'high' | 'medium' | 'low' ?? 'medium',
      description: prediction
        ? `AI-predicted ${prediction.primary_failure_mode}. RUL: ${prediction.rul_days}d. Confidence: ${Math.round(prediction.confidence * 100)}%.`
        : `Routine inspection of ${segment.name}.`,
      prediction_id: prediction?.id ?? null,
    });
    if (isOffline) {
      queueOfflineWorkOrder({ ...wo, _queued: true });
    }
    setTab('workorders');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Drawer Header ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        background: `${color}10`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {segment.name}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
              {segment.diameter_inches}" · {segment.material} · Installed {segment.installation_year}
            </div>
          </div>
          <button className="btn btn-icon" onClick={() => selectSegment(null)}>
            <X size={14} />
          </button>
        </div>

        {/* Health bar */}
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Health Score</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color }}>
              {segment.health_score}%
            </span>
          </div>
          <div style={{ height: '5px', background: '#2D2D2D', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${segment.health_score}%`,
              background: color, borderRadius: '3px', transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        flexShrink: 0, background: '#1A1C23',
      }}>
        {(['overview', 'sensors', 'workorders'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '8px 4px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 600,
              color: tab === t ? '#0090FF' : 'var(--text-muted)',
              borderBottom: `2px solid ${tab === t ? '#0090FF' : 'transparent'}`,
              textTransform: 'capitalize' as const,
              transition: 'color 0.15s',
            }}
          >
            {t === 'workorders' ? `WOs (${segWorkOrders.length})` : t}
          </button>
        ))}
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {/* Overview Tab */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[
                { icon: <Thermometer size={12} />, label: 'Wall Thick.', value: `${segment.wall_thickness_mm} mm`, color: segment.wall_thickness_mm < 10 ? '#E5484D' : '#E8ECEF' },
                { icon: <Activity size={12} />, label: 'Pressure', value: `${segment.operating_pressure_psi} PSI`, color: '#E8ECEF' },
                { icon: <Clock size={12} />, label: 'Last PIG', value: segment.last_pig_run ?? 'None', color: '#9E9E9E' },
                { icon: <Clock size={12} />, label: 'Next PIG', value: segment.next_pig_due ?? 'N/A', color: '#9E9E9E' },
              ].map(({ icon, label, value, color: vc }) => (
                <div key={label} style={{
                  background: '#1A1C23', border: '1px solid var(--border)',
                  borderRadius: '5px', padding: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', color: 'var(--text-muted)' }}>
                    {icon}
                    <span style={{ fontSize: '10px' }}>{label}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: vc }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Prediction Card */}
            {prediction ? (
              <PredictionCard prediction={prediction} onCreateWorkOrder={handleCreateWO} />
            ) : (
              <div style={{
                padding: '16px', background: 'var(--color-good-dim)',
                border: '1px solid rgba(46,204,64,0.25)', borderRadius: '6px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#30A46C', fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}>
                  ✓ No anomalies detected
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  All sensor readings within normal parameters.
                  {segment.next_pig_due && ` Next inspection due ${fmt(segment.next_pig_due, 'dd MMM yyyy')}.`}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sensors Tab */}
        {tab === 'sensors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {sensors.length > 0 ? (
              sensors.map(s => <SensorSparkline key={s.id} sensor={s} />)
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '12px' }}>
                No sensors assigned to this segment.
              </div>
            )}
          </div>
        )}

        {/* Work Orders Tab */}
        {tab === 'workorders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button className="btn btn-primary" onClick={handleCreateWO} style={{ width: '100%', fontSize: '12px', marginBottom: '4px' }}>
              + Create Work Order
            </button>
            {segWorkOrders.length > 0 ? (
              segWorkOrders.map(wo => (
                <div key={wo.id} style={{
                  background: '#1A1C23', border: '1px solid var(--border)',
                  borderRadius: '5px', padding: '10px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {wo.id}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: 600, padding: '1px 6px',
                      borderRadius: '2px', textTransform: 'uppercase' as const,
                      background: wo.status === 'completed' ? 'rgba(46,204,64,0.15)' : wo.status === 'in_progress' ? 'rgba(0,120,212,0.15)' : 'rgba(255,220,0,0.15)',
                      color: wo.status === 'completed' ? '#2ECC40' : wo.status === 'in_progress' ? '#0078D4' : '#FFDC00',
                    }}>
                      {wo.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {wo.title}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {wo.assigned_to ?? 'Unassigned'} · Due: {wo.due_date ?? 'N/A'}
                  </div>
                  {wo._queued && (
                    <div style={{ marginTop: '4px', fontSize: '10px', color: '#FFDC00' }}>
                      ⏱ Queued – will sync when online
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '12px' }}>
                <AlertTriangle size={20} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <div>No active prescriptions.</div>
                <div style={{ fontSize: '11px', marginTop: '4px' }}>
                  {segment.next_pig_due && `Next inspection due ${fmt(segment.next_pig_due, 'dd MMM yyyy')}.`}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
