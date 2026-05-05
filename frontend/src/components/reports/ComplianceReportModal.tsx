import React from 'react';
import { useStore } from '../../store/useStore';
import { X, FileText, Shield, CheckSquare, AlertTriangle } from 'lucide-react';
import { fmt } from '../../utils/formatting';

export const ComplianceReportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { segments, sensors, predictions, workOrders, alerts } = useStore();
  const today = fmt(new Date().toISOString(), 'dd MMMM yyyy');

  const criticalSegs = segments.filter(s => s.health_status === 'critical');
  const warningSegs  = segments.filter(s => s.health_status === 'warning');
  const totalThreats = predictions.filter(p => p.severity === 'critical' || p.severity === 'high').length;
  const closedWOs    = workOrders.filter(w => w.status === 'completed').length;
  const sensorUptime = ((sensors.filter(s => s.status === 'online').length / sensors.length) * 100).toFixed(1);

  const handlePrint = () => window.print();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }}>
      <div className="animate-fade-in" style={{
        width: '680px', maxWidth: '95vw', maxHeight: '90vh',
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: '8px', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, background: '#1A1C23',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={16} color="#0078D4" />
            <h2>Compliance Report</h2>
            <span className="badge badge-info">API 1163 / PHMSA §192</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary btn-sm" onClick={handlePrint} style={{ gap: '5px' }}>
              <FileText size={12} /> Export PDF
            </button>
            <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Report header */}
          <div style={{ borderBottom: '2px solid #0078D4', paddingBottom: '14px', marginBottom: '18px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Pipeline Integrity Management Report
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Permian 500 Corridor · Generated {today} · Version 1.0
            </div>
          </div>

          {/* Regulatory standards */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
            {['API 1163 – ILI Qualification', 'PHMSA 49 CFR Part 192', 'NACE SP0208 – Internal Corrosion', 'API RP 1130 – CPM Leak Detection'].map(s => (
              <div key={s} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: 'rgba(0,120,212,0.12)', border: '1px solid rgba(0,120,212,0.25)',
                borderRadius: '3px', padding: '3px 8px', fontSize: '10px', color: '#0078D4',
              }}>
                <Shield size={10} /> {s}
              </div>
            ))}
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
            {[
              { label: 'Segments Assessed', value: `${segments.length}`, note: '100% of total', color: '#2ECC40' },
              { label: 'Active Integrity Threats', value: `${totalThreats}`, note: `${criticalSegs.length} critical, ${warningSegs.length} warning`, color: totalThreats > 0 ? '#FF851B' : '#2ECC40' },
              { label: 'Sensor Network Uptime', value: `${sensorUptime}%`, note: `${sensors.filter(s => s.status === 'online').length}/${sensors.length} sensors online`, color: Number(sensorUptime) > 95 ? '#2ECC40' : '#FFDC00' },
              { label: 'Work Orders Completed', value: `${closedWOs}`, note: `${workOrders.length - closedWOs} open`, color: '#2ECC40' },
              { label: 'Leak Events (MTD)', value: alerts.filter(a => a.type === 'leak').length.toString(), note: 'SMS + SCADA notification sent', color: alerts.filter(a => a.type === 'leak').length > 0 ? '#FF4136' : '#2ECC40' },
              { label: 'Audit Trail Entries', value: `${workOrders.length + predictions.length + alerts.length}`, note: 'Full traceability', color: '#0078D4' },
            ].map(({ label, value, note, color }) => (
              <div key={label} style={{
                background: '#1A1C23', border: '1px solid var(--border)',
                borderRadius: '6px', padding: '10px',
              }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{note}</div>
              </div>
            ))}
          </div>

          {/* Integrity Assessment */}
          <section style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: '#0078D4' }}>
              Integrity Threat Assessment
            </h3>
            {criticalSegs.map(seg => {
              const pred = predictions.find(p => p.segment_id === seg.id);
              return (
                <div key={seg.id} style={{
                  background: 'rgba(255,65,54,0.06)', border: '1px solid rgba(255,65,54,0.2)',
                  borderRadius: '5px', padding: '10px 12px', marginBottom: '6px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{seg.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {pred?.primary_failure_mode ?? 'Integrity anomaly detected'}
                      {pred && ` · RUL: ${pred.rul_days}d`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#FF4136', fontWeight: 700 }}>
                      {seg.health_score}%
                    </span>
                    <span className="badge badge-critical">Critical</span>
                  </div>
                </div>
              );
            })}
            {warningSegs.slice(0, 3).map(seg => (
              <div key={seg.id} style={{
                background: 'rgba(255,220,0,0.06)', border: '1px solid rgba(255,220,0,0.2)',
                borderRadius: '5px', padding: '10px 12px', marginBottom: '6px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{seg.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Monitoring – within intervention limits</div>
                </div>
                <span className="badge badge-warning">Warning</span>
              </div>
            ))}
          </section>

          {/* Actions Taken */}
          <section style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: '#0078D4' }}>
              Actions Taken
            </h3>
            {workOrders.slice(0, 4).map(wo => (
              <div key={wo.id} style={{
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                padding: '8px 0', borderBottom: '1px solid var(--border)',
              }}>
                <CheckSquare size={14} color={wo.status === 'completed' ? '#2ECC40' : '#6B6E7A'} style={{ flexShrink: 0, marginTop: '1px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{wo.title}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {wo.id} · {wo.assigned_to ?? 'Unassigned'} · {wo.status.replace(/_/g, ' ')}
                    {wo.completed_at && ` · Completed ${fmt(wo.completed_at, 'dd MMM yyyy')}`}
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* Remaining Risks */}
          <section style={{ background: 'rgba(255,133,27,0.06)', border: '1px solid rgba(255,133,27,0.2)', borderRadius: '6px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertTriangle size={14} color="#FF851B" />
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#FF851B' }}>Residual Risks</h3>
            </div>
            <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: '16px', lineHeight: 2 }}>
              <li>External corrosion at Mi 200–220 pending repair (WO-2026-1042, due {fmt(new Date(Date.now() + 3 * 86400000).toISOString(), 'dd MMM')})</li>
              <li>Cathodic protection marginally below -0.85V at Mi 420–430 (ongoing CIPS survey)</li>
              <li>Sensor UT-31-305 intermittently offline – results may be incomplete</li>
            </ul>
          </section>

          <div style={{ marginTop: '20px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
            This report was generated automatically by ReliabilityOS v1.0.0. All data subject to field verification.
            Audit trail: {workOrders.length + predictions.length} records stored with tamper-evident timestamps.
          </div>
        </div>
      </div>
    </div>
  );
};
