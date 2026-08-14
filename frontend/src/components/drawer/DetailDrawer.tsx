import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import type { WorkOrder } from '../../types';
import { healthColor } from '../../utils/colors';
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

  // health_score is nullable (no open-alert history yet) -- healthColor
  // needs a number, so default the color calc to 100 (healthiest) rather
  // than showing a false "0/critical" color for an asset that just has no
  // data yet. The displayed number still shows the real null as "-".
  const color = healthColor(segment.health_score ?? 100);

  // createWorkOrder is now a real async POST. If offline, calling it would
  // just fail with no network -- branch before hitting the network, same
  // pattern as WorkOrderModal.tsx. Real offline sync isn't wired yet
  // (separate follow-up).
  const handleCreateWO = async () => {
    const description = prediction
      ? `AI-predicted ${prediction.primary_failure_mode ?? prediction.failure_mode ?? 'anomaly'}. RUL: ${prediction.rul_days ?? '?'}d. Confidence: ${prediction.confidence != null ? Math.round(prediction.confidence * 100) + '%' : 'n/a'}.`
      : `Routine inspection of ${segment.name}.`;

    if (isOffline) {
      const now = new Date().toISOString();
      const localWo: WorkOrder = {
        id: `LOCAL-${Date.now()}`,
        title: `Inspection: ${segment.name}`,
        segment_id: segment.id,
        status: 'draft',
        priority: (prediction?.severity as 'critical' | 'high' | 'medium' | 'low') ?? 'medium',
        description,
        repair_procedure: null,
        estimated_downtime_hours: 4,
        assigned_to: null,
        created_at: now,
        updated_at: now,
        due_date: null,
        completed_at: null,
        prediction_id: prediction?.id ?? null,
        technician_notes: null,
        actual_root_cause: null,
        alert_id: null,
      };
      queueOfflineWorkOrder(localWo);
    } else {
      await createWorkOrder({
        title: `Inspection: ${segment.name}`,
        segment_id: segment.id,
        priority: (prediction?.severity as 'critical' | 'high' | 'medium' | 'low') ?? 'medium',
        description,
        prediction_id: prediction?.id ?? undefined,
      });
    }
    setTab('workorders');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
              {segment.platform}{segment.line ? ` - ${segment.line}` : ''}
            </div>
          </div>
          <button className="btn btn-icon" onClick={() => selectSegment(null)}>
            <X size={14} />
          </button>
        </div>

        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Health Score</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color }}>
              {segment.health_score ?? '-'}%
            </span>
          </div>
          <div style={{ height: '5px', background: '#2D2D2D', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${segment.health_score ?? 0}%`,
              background: color, borderRadius: '3px', transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Zone (seeded label)</span>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'capitalize' as const }}>
              {segment.zone ?? '-'}
            </span>
          </div>
        </div>
      </div>

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

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Physical pipe specs (wall thickness, pressure, diameter,
                material, install year) are NOT in the real schema -- shown
                as "-" rather than fabricated. Will populate once real
                vendor/pipeline spec data exists. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[
                { icon: <Thermometer size={12} />, label: 'Wall Thick.', value: '-', color: '#E8ECEF' },
                { icon: <Activity size={12} />, label: 'Pressure', value: '-', color: '#E8ECEF' },
                { icon: <Clock size={12} />, label: 'Last PIG', value: 'None', color: '#9E9E9E' },
                { icon: <Clock size={12} />, label: 'Next PIG', value: 'N/A', color: '#9E9E9E' },
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

            {prediction ? (
              <PredictionCard prediction={prediction} onCreateWorkOrder={handleCreateWO} />
            ) : (
              <div style={{
                padding: '16px', background: 'var(--color-good-dim)',
                border: '1px solid rgba(46,204,64,0.25)', borderRadius: '6px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#30A46C', fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}>
                  No anomalies detected
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  No AI prediction on record for this segment. The prediction model service is not yet built -- see /api/v1/predictions.
                </div>
              </div>
            )}
          </div>
        )}

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
                    {wo.assigned_to ?? 'Unassigned'} - Due: {wo.due_date ?? 'N/A'}
                  </div>
                  {wo._queued && (
                    <div style={{ marginTop: '4px', fontSize: '10px', color: '#FFDC00' }}>
                      Queued - will sync when online
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '12px' }}>
                <AlertTriangle size={20} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <div>No work orders yet for this segment.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

