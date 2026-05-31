import React, { useState } from 'react';
import { PIG_RUNS } from '../../data/mockData';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { X, GitCompare } from 'lucide-react';
import { PIGRun, PIGFinding } from '../../types';
import { default as SensorConnectionsCard } from '../sensors/SensorConnectionsCard';

export const PIGComparisonModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [runAId, setRunAId] = useState(PIG_RUNS[1]?.id ?? '');
  const [runBId, setRunBId] = useState(PIG_RUNS[0]?.id ?? '');

  const runA = PIG_RUNS.find((r: PIGRun) => r.id === runAId);
  const runB = PIG_RUNS.find((r: PIGRun) => r.id === runBId);

  // Build comparison table: merge findings by approximate mile marker
  const comparisonData = React.useMemo(() => {
    if (!runA || !runB) return [];
    const allMiles = [...new Set([
      ...runA.findings.map((f: PIGFinding) => Math.round(f.mile_marker * 10) / 10),
      ...runB.findings.map((f: PIGFinding) => Math.round(f.mile_marker * 10) / 10),
    ])].sort((a, b) => a - b);

    return allMiles.map(mile => {
     const fA = runA.findings.find((f: PIGFinding) => Math.abs(f.mile_marker - mile) < 0.5);
    const fB = runB.findings.find((f: PIGFinding) => Math.abs(f.mile_marker - mile) < 0.5);
      const growthRate = fA && fB
        ? +((fB.metal_loss_percent - fA.metal_loss_percent) /
           ((new Date(runB.date).getTime() - new Date(runA.date).getTime()) / (1000 * 3600 * 24 * 365))).toFixed(2)
        : null;
      // Forecast in 2 years
      const forecast = fB && growthRate !== null
        ? +(fB.metal_loss_percent + growthRate * 2).toFixed(1)
        : null;

      return {
        mile,
        [runA.date]: fA?.metal_loss_percent ?? null,
        [runB.date]: fB?.metal_loss_percent ?? null,
        growth_rate: growthRate,
        forecast_2yr: forecast,
        feature_type: fB?.feature_type ?? fA?.feature_type ?? '–',
        orientation: fB?.orientation ?? fA?.orientation ?? '–',
      };
    });
  }, [runA, runB]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }}>
      <div className="animate-fade-in" style={{
        width: '820px', maxWidth: '95vw', maxHeight: '90vh',
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
            <GitCompare size={16} color="#9B53D4" />
            <h2>PIG Run Comparison</h2>
          </div>
          <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {/* Sensor Connections (placed above existing PIG UI) */}
          <div style={{ marginBottom: '24px' }}>
            {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
            <SensorConnectionsCard />
          </div>

          {/* Run selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            {([
              { label: 'Baseline (Earlier Run)', stateKey: runAId, setter: setRunAId, color: '#0078D4' },
              { label: 'Comparison (Later Run)', stateKey: runBId, setter: setRunBId, color: '#FF851B' },
            ] as { label: string; stateKey: string; setter: (v: string) => void; color: string }[]).map(({ label, stateKey, setter, color }) => (
              <div key={label}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{label}</label>
                <select
                  value={stateKey}
                  onChange={e => setter(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: '#252830', border: `1px solid ${color}50`, borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px', colorScheme: 'dark' }}
                >
                  {PIG_RUNS.map((r: PIGRun) => (
                    <option key={r.id} value={r.id}>{r.date} – {r.type} ({r.vendor})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {runA && runB && (
            <>
              {/* Run summaries */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                {[runA, runB].map((run, i) => (
                  <div key={run.id} style={{
                    background: '#1A1C23', border: `1px solid ${i === 0 ? '#0078D430' : '#FF851B30'}`,
                    borderRadius: '6px', padding: '12px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, color: i === 0 ? '#0078D4' : '#FF851B', fontSize: '14px' }}>
                        {run.date}
                      </span>
                      <span className="badge badge-info" style={{ fontSize: '10px' }}>{run.type}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 2 }}>
                      <div>Vendor: <span style={{ color: 'var(--text-secondary)' }}>{run.vendor}</span></div>
                      <div>Findings: <span style={{ color: run.findings.length > 5 ? '#FF851B' : '#2ECC40', fontWeight: 600 }}>{run.findings.length}</span></div>
                      <div>Max loss: <span style={{ color: '#E0E0E0', fontFamily: 'var(--font-mono)' }}>
                        {Math.max(...run.findings.map((f: PIGFinding) => f.metal_loss_percent))}%
                      </span></div>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>{run.summary}</p>
                  </div>
                ))}
              </div>

              {/* Chart */}
              {comparisonData.length > 0 && (
                <div style={{ background: '#1A1C23', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', marginBottom: '14px' }}>
                  <h3 style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Metal Loss Comparison (% wall thickness) + Forecast
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={comparisonData} margin={{ bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2D36" vertical={false} />
                      <XAxis dataKey="mile" tick={{ fill: '#6B6E7A', fontSize: 10 }}
                        label={{ value: 'Mile Marker', position: 'insideBottom', offset: -8, fill: '#6B6E7A', fontSize: 11 }}
                      />
                      <YAxis tick={{ fill: '#6B6E7A', fontSize: 10 }}
                        label={{ value: '% metal loss', angle: -90, position: 'insideLeft', fill: '#6B6E7A', fontSize: 11 }}
                        domain={[0, 70]}
                      />
                      <Tooltip
                        contentStyle={{ background: '#252830', border: '1px solid #3A3D48', fontSize: '11px' }}
                        formatter={(v: number, name: string) => [`${v}%`, name]}
                      />
                      <ReferenceLine y={40} stroke="#FFDC00" strokeDasharray="4 3" label={{ value: '40% limit', fill: '#FFDC00', fontSize: 9 }} />
                      <Legend wrapperStyle={{ fontSize: '11px', bottom: 0 }} />
                      <Bar dataKey={runA.date} name={`${runA.date} (${runA.type})`} fill="#0078D4" opacity={0.8} />
                      <Bar dataKey={runB.date} name={`${runB.date} (${runB.type})`} fill="#FF851B" opacity={0.8} />
                      <Bar dataKey="forecast_2yr" name="2-Year Forecast" fill="#9B53D4" opacity={0.6} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Findings table */}
              <div style={{ background: '#1A1C23', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: '#161820' }}>
                  <h3 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Feature Growth Rates</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#1A1C23' }}>
                      {['Mile', `${runA.date} (%WT)`, `${runB.date} (%WT)`, 'Growth (% yr⁻¹)', '2yr Forecast (%)', 'Feature', 'Orientation'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '10px', borderBottom: '1px solid var(--border)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((row, i) => {
                      const growthAlarm = (row.growth_rate ?? 0) > 5;
                      return (
                        <tr key={row.mile} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{row.mile}</td>
                          <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: '#0078D4' }}>
                            {(row as Record<string, unknown>)[runA.date] != null ? `${(row as Record<string, unknown>)[runA.date]}%` : '–'}
                          </td>
                          <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: '#FF851B' }}>
                            {(row as Record<string, unknown>)[runB.date] != null ? `${(row as Record<string, unknown>)[runB.date]}%` : '–'}
                          </td>
                          <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: growthAlarm ? '#FF4136' : '#2ECC40', fontWeight: growthAlarm ? 700 : 400 }}>
                            {row.growth_rate != null ? `${row.growth_rate}%` : '–'}
                            {growthAlarm && ' ⚠'}
                          </td>
                          <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: (row.forecast_2yr ?? 0) > 40 ? '#FF4136' : 'var(--text-secondary)' }}>
                            {row.forecast_2yr != null ? `${row.forecast_2yr}%` : '–'}
                          </td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{row.feature_type}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{row.orientation}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
