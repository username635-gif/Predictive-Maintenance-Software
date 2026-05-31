import React, { useState } from 'react';
import {
  ComposedChart, Line, Area, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Brush
} from 'recharts';
import { useStore } from '../../store/useStore';
import { LONGITUDINAL_DATA } from '../../data/mockData';
import { healthColor } from '../../utils/colors';
import { Crosshair } from 'lucide-react';

type Metric = 'wall_thickness' | 'pressure' | 'health_score' | 'corrosion_rate';

const METRICS: { key: Metric; label: string; unit: string; color: string; yDomain: [number, number] }[] = [
  { key: 'wall_thickness',  label: 'Wall Thickness', unit: 'mm',      color: '#5ABFA5', yDomain: [8, 14] },

  { key: 'pressure',        label: 'Pressure',       unit: 'PSI',     color: '#8E87D6', yDomain: [650, 760] },
  { key: 'health_score',    label: 'Health Score',   unit: '%',       color: '#378ADD', yDomain: [0, 100] },
  { key: 'corrosion_rate',  label: 'Corrosion Rate', unit: 'mm/yr',   color: '#D4A24B', yDomain: [0, 1.2] },

];

// Custom tooltip
const CustomTooltip: React.FC<{
  active?: boolean; payload?: { dataKey: string; value: number; color?: string }[];
  label?: number;
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1E1E1E', border: '1px solid #3A3D48', borderRadius: '6px',
      padding: '10px 14px', fontSize: '12px',
    }}>
              <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Mile {label}

      </div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}>
          <span style={{ color: p.color ?? 'var(--text-secondary)' }}>●</span>

                <span style={{ color: 'var(--text-muted)' }}>{p.dataKey.replace(/_/g, ' ')}:</span>

          <span style={{ color: '#E0E0E0', fontFamily: 'monospace' }}>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export const LongitudinalView: React.FC = () => {
  const { segments, selectedSegmentId, selectSegment } = useStore();
  const [activeMetrics, setActiveMetrics] = useState<Set<Metric>>(new Set(['wall_thickness', 'health_score']));
  const [showPIG, setShowPIG] = useState(true);
  const [showForecast, setShowForecast] = useState(true);

  const toggleMetric = (m: Metric) => {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  };

  // Highlight band for selected segment
  const selectedSeg = selectedSegmentId ? segments.find(s => s.id === selectedSegmentId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px', gap: '10px' }}>
      {/* Controls */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>METRICS:</span>
        {METRICS.map(m => (
          <button
            key={m.key}
            className="btn btn-sm btn-ghost"
            onClick={() => toggleMetric(m.key)}
            style={{
              fontSize: '11px', gap: '5px',
              color: activeMetrics.has(m.key) ? m.color : 'var(--text-muted)',
              borderColor: activeMetrics.has(m.key) ? m.color : 'transparent',
              background: activeMetrics.has(m.key) ? `${m.color}18` : 'transparent',
            }}
          >
            <span style={{
              display: 'inline-block', width: '10px', height: '3px',
              background: m.color, borderRadius: '2px',
            }} />
            {m.label} ({m.unit})
          </button>
        ))}
        <div style={{ height: '20px', width: '1px', background: 'var(--border)' }} />
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setShowPIG(!showPIG)}
          style={{
            fontSize: '11px', gap: '5px',
            color: showPIG ? '#FF851B' : 'var(--text-muted)',
            borderColor: showPIG ? '#FF851B' : 'transparent',
          }}
        >
          ◆ PIG Runs
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setShowForecast(!showForecast)}
          style={{
            fontSize: '11px', gap: '5px',
            color: showForecast ? '#9B53D4' : 'var(--text-muted)',
            borderColor: showForecast ? '#9B53D4' : 'transparent',
          }}
        >
          ⟶ Forecast
        </button>

        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <Crosshair size={12} />
          Click chart or drag to zoom • Click segment to select
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={LONGITUDINAL_DATA}
            margin={{ top: 10, right: 20, bottom: 40, left: 10 }}
            onClick={(data) => {
              if (data?.activePayload?.[0]) {
                const mile = data.activePayload[0].payload.mile;
                const seg = segments.find(s => s.mile_start <= mile && s.mile_end > mile);
                if (seg) selectSegment(seg.id === selectedSegmentId ? null : seg.id);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#3B4560" vertical={false} />


            <XAxis
              dataKey="mile"
              label={{ value: 'Mile Marker', position: 'insideBottom', offset: -10, fill: '#6B6E7A', fontSize: 12 }}
              tick={{ fill: '#6B6E7A', fontSize: 11 }}
              tickFormatter={v => `${v}`}
            />

            {/* Left Y-axis for wall thickness */}
            <YAxis
              yAxisId="thickness"
              domain={[8, 14]}
              tick={{ fill: '#5ABFA5', fontSize: 10 }}

              label={{ value: 'mm', angle: -90, position: 'insideLeft', fill: '#5ABFA5', fontSize: 11 }}

              hide={!activeMetrics.has('wall_thickness')}
            />

            {/* Right Y-axis for health score */}
            <YAxis
              yAxisId="health"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: '#378ADD', fontSize: 10 }}

              label={{ value: '%', angle: 90, position: 'insideRight', fill: '#378ADD', fontSize: 11 }}

              hide={!activeMetrics.has('health_score')}
            />

            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ bottom: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}
            />


            {/* Segment health background colours (critical zones) */}
            {segments
              .filter(s => s.health_status !== 'good')
              .map(s => (
                <ReferenceLine
                  key={s.id}
                  x={s.mile_start}
                  stroke={healthColor(s.health_score)}
                  strokeWidth={0.5}
                  strokeDasharray="2 4"
                  yAxisId="health"
                />
              ))}

            {/* Selected segment highlight */}
            {selectedSeg && (
              <>
                <ReferenceLine x={selectedSeg.mile_start} stroke="#378ADD" strokeWidth={2} yAxisId="health" />
                <ReferenceLine x={selectedSeg.mile_end}   stroke="#378ADD" strokeWidth={2} yAxisId="health" />

              </>
            )}

            {/* Wall Thickness */}
            {activeMetrics.has('wall_thickness') && (
              <Line
                yAxisId="thickness"
                type="monotone"
                dataKey="wall_thickness"
                name="Wall Thickness (mm)"
                stroke="#5ABFA5"

                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#5ABFA5' }}

              />
            )}

            {/* Health Score area */}
            {activeMetrics.has('health_score') && (
              <Area
                yAxisId="health"
                type="monotone"
                dataKey="health_score"
                name="Health Score (%)"
                stroke="#378ADD"
                fill="rgba(55,138,221,0.08)"

                strokeWidth={1.5}
                dot={false}
              />
            )}

            {/* Pressure */}
            {activeMetrics.has('pressure') && (
              <Line
                yAxisId="health"
                type="monotone"
                dataKey="pressure"
                name="Pressure (PSI × 0.1)"
                stroke="#8E87D6"
                strokeWidth={1.5}
                dot={false}

                // scale pressure to 0-100 in health axis for overlay
              />
            )}

            {/* Corrosion Rate */}
            {activeMetrics.has('corrosion_rate') && (
              <Line
                yAxisId="health"
                type="monotone"
                dataKey="corrosion_rate"
                name="Corrosion Rate (mm/yr)"
                stroke="#D4A24B"
                strokeWidth={1.5}

                dot={false}
                strokeDasharray="4 2"
              />
            )}

            {/* PIG 2022 */}
            {showPIG && (
              <Scatter
                yAxisId="health"
                dataKey="pig_2022"
                name="PIG 2022 – % metal loss"
                fill="#F06A50"
                shape="diamond"

              />
            )}

            {/* PIG 2024 */}
            {showPIG && (
              <Scatter
                yAxisId="health"
                dataKey="pig_2024"
                name="PIG 2024 – % metal loss"
                fill="#F06A50"
                shape="star"

              />
            )}

            {/* Forecast */}
            {showForecast && (
              <Line
                yAxisId="health"
                type="monotone"
                dataKey="forecast"
                name="2027 Forecast (% loss)"
                stroke="#6B7280"
                strokeDasharray="6 3"

                strokeWidth={1.5}
                dot={false}
              />
            )}

            <Brush
              dataKey="mile"
              height={20}

              stroke="#2D2D2D"
              fill="#1A1C23"
              travellerWidth={6}
              y={380}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Segment colour band (x-axis strip) */}
      <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>

        {segments.map(seg => (
          <div
            key={seg.id}
            title={`${seg.name} – ${seg.health_score}%`}
            style={{
              flex: 1,
              background: healthColor(seg.health_score),
              opacity: selectedSegmentId === seg.id ? 1 : 0.7,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onClick={() => selectSegment(seg.id === selectedSegmentId ? null : seg.id)}
          />
        ))}
      </div>
    </div>
  );
};
