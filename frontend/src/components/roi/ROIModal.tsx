import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { fmtROI, fmtCurrency } from '../../utils/formatting';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { X, TrendingUp, DollarSign, Clock, AlertTriangle } from 'lucide-react';

export const ROIModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { roiHistory, roiConfig, updateROIConfig, getTotalROI } = useStore();
  const [editing, setEditing] = useState(false);
  const [cfg, setCfg] = useState({ ...roiConfig });

  const totalROI = getTotalROI();
  const totalDowntimeAvoided = roiHistory.reduce((s, m) => s + m.downtime_avoided_hours, 0);
  const totalEmergenciesAvoided = roiHistory.reduce((s, m) => s + m.emergency_repairs_avoided, 0);

  const handleSave = () => {
    updateROIConfig(cfg);
    setEditing(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }}>
      <div className="animate-fade-in" style={{
        width: '700px', maxWidth: '95vw', maxHeight: '85vh',
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: '8px', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, background: 'rgba(46,204,64,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={18} color="#2ECC40" />
            <h2>ROI Dashboard</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Year-to-date</span>
          </div>
          <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
            {[
              { icon: <DollarSign size={16} color="#2ECC40" />, label: 'Total ROI (YTD)', value: fmtROI(totalROI), color: '#2ECC40', sub: 'vs reactive baseline' },
              { icon: <Clock size={16} color="#0078D4" />, label: 'Downtime Avoided', value: `${totalDowntimeAvoided}h`, color: '#0078D4', sub: `≈ ${fmtROI(totalDowntimeAvoided * roiConfig.downtime_cost_per_hour)}` },
              { icon: <AlertTriangle size={16} color="#FF851B" />, label: 'Emergencies Avoided', value: String(totalEmergenciesAvoided), color: '#FF851B', sub: `≈ ${fmtROI(totalEmergenciesAvoided * roiConfig.avg_emergency_repair_cost)} saved` },
              { icon: <TrendingUp size={16} color="#9B53D4" />, label: 'Planned vs Emergency', value: fmtROI(roiHistory.reduce((s, m) => s + m.planned_vs_emergency_savings, 0)), color: '#9B53D4', sub: 'cost differential saved' },
            ].map(({ icon, label, value, color, sub }) => (
              <div key={label} style={{
                background: '#1A1C23', border: `1px solid ${color}25`,
                borderRadius: '6px', padding: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: 'var(--text-muted)' }}>
                  {icon}
                  <span style={{ fontSize: '11px' }}>{label}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            {/* Monthly ROI bar chart */}
            <div style={{ background: '#1A1C23', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>Monthly ROI Breakdown</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={roiHistory} margin={{ bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2D36" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#6B6E7A', fontSize: 10 }} />
                  <YAxis tickFormatter={(v: number) => `$${v/1000}K`} tick={{ fill: '#6B6E7A', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#252830', border: '1px solid #3A3D48', fontSize: '11px' }}
                    formatter={(v: number) => [fmtCurrency(v), '']}
                  />
                  <Bar dataKey="downtime_value" name="Downtime Value" fill="#0078D4" stackId="a" />
                  <Bar dataKey="emergency_cost_avoided" name="Emergency Cost" fill="#FF851B" stackId="a" />
                  <Bar dataKey="planned_vs_emergency_savings" name="Plan Savings" fill="#2ECC40" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cumulative ROI line */}
            <div style={{ background: '#1A1C23', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>Cumulative ROI</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart
                  data={roiHistory.reduce<{ month: string; cumROI: number }[]>((acc, m) => {
                    const prev = acc.length > 0 ? acc[acc.length - 1].cumROI : 0;
                    return [...acc, { month: m.month, cumROI: prev + m.total_roi }];
                  }, [])}
                  margin={{ bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2D36" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#6B6E7A', fontSize: 10 }} />
                  <YAxis tickFormatter={(v: number) => `$${(v/1000000).toFixed(1)}M`} tick={{ fill: '#6B6E7A', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#252830', border: '1px solid #3A3D48', fontSize: '11px' }}
                    formatter={(v: number) => [fmtCurrency(v), 'Cumulative ROI']}
                  />
                  <Line type="monotone" dataKey="cumROI" stroke="#2ECC40" strokeWidth={2.5} dot={{ fill: '#2ECC40', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Config */}
          <div style={{ background: '#1A1C23', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cost Assumptions (Configurable)</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {editing ? (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setCfg({ ...roiConfig }); }}>Cancel</button>
                  </>
                ) : (
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit</button>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {[
                { key: 'downtime_cost_per_hour', label: '$/hr Downtime' },
                { key: 'avg_emergency_repair_cost', label: 'Avg Emergency Repair $' },
                { key: 'avg_planned_repair_cost', label: 'Avg Planned Repair $' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>{label}</label>
                  {editing ? (
                    <input
                      type="number"
                      value={cfg[key as keyof typeof cfg] as number}
                      onChange={e => setCfg(p => ({ ...p, [key]: Number(e.target.value) }))}
                      style={{ width: '100%', padding: '6px 8px', background: '#252830', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                  ) : (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 600, color: '#2ECC40' }}>
                      {fmtCurrency(roiConfig[key as keyof typeof roiConfig] as number)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
