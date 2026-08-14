import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import type { WorkOrder } from '../../types';
import { priorityColor, statusColor } from '../../utils/colors';
import { X, Plus, Camera, CheckCircle, Wrench, Package } from 'lucide-react';

export const WorkOrderModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    workOrders, createWorkOrder, updateWorkOrder,
    isOffline, queueOfflineWorkOrder, segments
  } = useStore();

  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [creating, setCreating] = useState(false);
  const [newWO, setNewWO] = useState({
    title: '', segment_id: '', priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    description: '', assigned_to: '', due_date: '',
  });

  const filtered = workOrders.filter(wo =>
    filter === 'all' ? true : wo.status === filter
  );

  // createWorkOrder is now a real async POST to the backend. If we are
  // offline, calling it would just fail with no network -- branch before
  // hitting the network at all, rather than after. Real offline sync
  // (POST /api/v1/workorders/sync) is not wired from syncOfflineQueue yet;
  // that's a separate follow-up, not part of this fix.
  const handleCreate = async () => {
    if (!newWO.title.trim()) return;

    if (isOffline) {
      const now = new Date().toISOString();
      const localWo: WorkOrder = {
        id: `LOCAL-${Date.now()}`,
        title: newWO.title,
        segment_id: newWO.segment_id,
        status: 'draft',
        priority: newWO.priority,
        description: newWO.description || null,
        repair_procedure: null,
        estimated_downtime_hours: 4,
        assigned_to: newWO.assigned_to || null,
        created_at: now,
        updated_at: now,
        due_date: newWO.due_date || null,
        completed_at: null,
        prediction_id: null,
        technician_notes: null,
        actual_root_cause: null,
        alert_id: null,
      };
      queueOfflineWorkOrder(localWo);
    } else {
      await createWorkOrder({
        title: newWO.title,
        segment_id: newWO.segment_id,
        priority: newWO.priority,
        description: newWO.description,
        due_date: newWO.due_date || undefined,
        assigned_to: newWO.assigned_to || undefined,
      });
    }

    setCreating(false);
    setNewWO({ title: '', segment_id: '', priority: 'medium', description: '', assigned_to: '', due_date: '' });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }}>
      <div className="animate-fade-in" style={{
        width: '720px', maxWidth: '95vw', maxHeight: '85vh',
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
            <Wrench size={16} color="#0090FF" />
            <h2>Work Orders</h2>
            {isOffline && (
              <span className="badge badge-offline">Offline - Changes queued</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setCreating(!creating)} style={{ gap: '5px' }}>
              <Plus size={13} /> New WO
            </button>
            <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        {creating && (
          <div className="animate-fade-in" style={{
            padding: '14px 18px', borderBottom: '1px solid var(--border)',
            background: 'rgba(0,120,212,0.05)', flexShrink: 0,
          }}>
            <h3 style={{ marginBottom: '10px', color: '#0090FF' }}>New Work Order</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Title *</label>
                <input
                  value={newWO.title}
                  onChange={e => setNewWO(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. External corrosion repair - Mile 205"
                  style={{
                    width: '100%', padding: '8px 10px', background: '#252830',
                    border: '1px solid var(--border)', borderRadius: '4px',
                    color: 'var(--text-primary)', fontSize: '13px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Segment</label>
                <select
                  value={newWO.segment_id}
                  onChange={e => setNewWO(p => ({ ...p, segment_id: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', background: '#252830', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                >
                  <option value="">Select segment...</option>
                  {segments.filter(s => s.zone !== 'good').map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Priority</label>
                <select
                  value={newWO.priority}
                  onChange={e => setNewWO(p => ({ ...p, priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' }))}
                  style={{ width: '100%', padding: '8px 10px', background: '#252830', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                >
                  {['critical', 'high', 'medium', 'low'].map(p => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Assign To</label>
                <input
                  value={newWO.assigned_to}
                  onChange={e => setNewWO(p => ({ ...p, assigned_to: e.target.value }))}
                  placeholder="Technician name"
                  style={{ width: '100%', padding: '8px 10px', background: '#252830', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Due Date</label>
                <input
                  type="date"
                  value={newWO.due_date}
                  onChange={e => setNewWO(p => ({ ...p, due_date: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', background: '#252830', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px', colorScheme: 'dark' }}
                />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Description</label>
                <textarea
                  value={newWO.description}
                  onChange={e => setNewWO(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the work needed..."
                  rows={2}
                  style={{ width: '100%', padding: '8px 10px', background: '#252830', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button className="btn btn-primary" onClick={handleCreate} style={{ gap: '5px' }}>
                <CheckCircle size={13} />
                {isOffline ? 'Queue Work Order (offline)' : 'Create Work Order'}
              </button>
              <button className="btn btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)',
          flexShrink: 0, padding: '0 18px',
        }}>
          {([
            ['all', 'All'],
            ['pending', 'Pending'],
            ['in_progress', 'In Progress'],
            ['completed', 'Completed'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: '8px 12px', background: 'transparent', border: 'none',
                cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                color: filter === key ? '#0090FF' : 'var(--text-muted)',
                borderBottom: `2px solid ${filter === key ? '#0090FF' : 'transparent'}`,
              }}
            >
              {label}
              <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--text-muted)' }}>
                ({workOrders.filter(w => key === 'all' ? true : w.status === key).length})
              </span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <CheckCircle size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <div>No work orders in this category.</div>
            </div>
          ) : (
            filtered.map(wo => (
              <WORow key={wo.id} wo={wo} onStatusChange={(status) => updateWorkOrder(wo.id, { status })} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const WORow: React.FC<{
  wo: WorkOrder;
  onStatusChange: (s: 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled') => void;
}> = ({ wo, onStatusChange }) => {
  const [expanded, setExpanded] = useState(false);
  const pColor = priorityColor(wo.priority);
  const sColor = statusColor(wo.status);

  return (
    <div style={{
      background: '#1A1C23', border: '1px solid var(--border)',
      borderLeft: `3px solid ${pColor}`,
      borderRadius: '6px', marginBottom: '8px',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', width: '100%', padding: '10px 14px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          alignItems: 'center', gap: '12px', textAlign: 'left',
        }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: pColor, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{wo.id}</span>
            {wo._queued && <span className="badge badge-warning" style={{ fontSize: '9px' }}>QUEUED</span>}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {wo.title}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
          <span style={{ background: `${sColor}25`, color: sColor, padding: '2px 7px', borderRadius: '3px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const }}>
            {wo.status.replace(/_/g, ' ')}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {wo.assigned_to ?? 'Unassigned'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="animate-fade-in" style={{ padding: '0 14px 14px' }}>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.6 }}>
              {wo.description}
            </p>
            {(wo.parts_list ?? []).length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                  <Package size={12} /> PARTS LIST
                </div>
                {(wo.parts_list ?? []).map(p => (
                  <div key={p.part_number} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{p.description}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>x{p.quantity}</span>
                      <span style={{ color: p.in_stock ? '#30A46C' : '#E5484D', fontSize: '10px' }}>
                        {p.in_stock ? 'In stock' : 'Order req.'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['pending', 'in_progress', 'completed'].map(s => (
                <button
                  key={s}
                  className="btn btn-secondary btn-sm"
                  onClick={() => onStatusChange(s as 'pending' | 'in_progress' | 'completed')}
                  style={{
                    fontSize: '11px',
                    background: wo.status === s ? `${statusColor(s)}20` : undefined,
                    borderColor: wo.status === s ? statusColor(s) : undefined,
                    color: wo.status === s ? statusColor(s) : undefined,
                  }}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
              <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px', gap: '4px', marginLeft: 'auto' }}>
                <Camera size={12} /> Add Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
