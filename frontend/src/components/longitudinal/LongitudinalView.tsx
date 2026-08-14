import React, { useMemo } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { useStore } from '../../store/useStore';
import { healthColor } from '../../utils/colors';

// Rebuilt from real per-segment data (health_score, zone) -- the original
// version plotted 100 fabricated per-mile points (wall_thickness, pressure,
// corrosion_rate, PIG scatter, forecast) with no backend source. None of
// those fields exist on the real PipelineSegment type. Deliberately
// removed rather than faked; they can come back once real sensor/PIG data
// exists to back them.
//
// X-axis is segment order (SEG-001..050), not mile marker -- there is no
// real structured mile-range column, only free text embedded in `name`
// (e.g. "SEG-021 Mile 200-210"). Parsing that string for a fake continuous
// axis would just be a different flavor of fabrication.

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: { payload: { name: string; health_score: number | null; zone: string | null; health_score_open_alerts: number } }[];
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const seg = payload[0].payload;
  return (
    <div style={{
      background: '#1E1E1E', border: '1px solid #3A3D48', borderRadius: '6px',
      padding: '10px 14px', fontSize: '12px',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>{seg.name}</div>
      <div style={{ color: 'var(--text-secondary)' }}>
        Health score: <span style={{ fontFamily: 'monospace' }}>{seg.health_score ?? '-'}</span>
      </div>
      <div style={{ color: 'var(--text-secondary)' }}>
        Zone (seeded label): <span style={{ fontFamily: 'monospace' }}>{seg.zone ?? '-'}</span>
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
        Open alerts: {seg.health_score_open_alerts}
      </div>
    </div>
  );
};

export const LongitudinalView: React.FC = () => {
  const { segments, selectedSegmentId, selectSegment } = useStore();

  const data = useMemo(
    () =>
      segments.map((s) => ({
        id: s.id,
        name: s.name,
        health_score: s.health_score,
        zone: s.zone,
        health_score_open_alerts: s.health_score_open_alerts,
      })),
    [segments]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
          HEALTH SCORE BY SEGMENT
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          (computed live from open alerts -- not a validated failure predictor)
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click a bar to select that segment</span>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 20, bottom: 40, left: 10 }}
            onClick={(e) => {
              const id = e?.activePayload?.[0]?.payload?.id;
              if (id) selectSegment(id === selectedSegmentId ? null : id);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#3B4560" vertical={false} />
            <XAxis
              dataKey="id"
              tick={{ fill: '#6B6E7A', fontSize: 9 }}
              interval={2}
              angle={-45}
              textAnchor="end"
              height={50}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#378ADD', fontSize: 10 }}
              label={{ value: 'Health Score', angle: -90, position: 'insideLeft', fill: '#378ADD', fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={40} stroke="#F06A50" strokeDasharray="4 3" label={{ value: 'critical', fill: '#F06A50', fontSize: 9 }} />
            <ReferenceLine y={70} stroke="#D4A24B" strokeDasharray="4 3" label={{ value: 'warning', fill: '#D4A24B', fontSize: 9 }} />
            <Bar dataKey="health_score" radius={[3, 3, 0, 0]}>
              {data.map((d) => (
                <Cell
                  key={d.id}
                  fill={d.health_score !== null ? healthColor(d.health_score) : '#3B4560'}
                  opacity={selectedSegmentId === d.id ? 1 : 0.75}
                  stroke={selectedSegmentId === d.id ? '#378ADD' : 'none'}
                  strokeWidth={selectedSegmentId === d.id ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Seeded zone strip -- shown separately from health_score by design,
          since the two are independently sourced and do not always agree. */}
      <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
        {segments.map((seg) => (
          <div
            key={seg.id}
            title={`${seg.name} - zone: ${seg.zone ?? 'unset'}`}
            style={{
              flex: 1,
              background: seg.zone === 'critical' ? '#F06A50' : seg.zone === 'warning' ? '#D4A24B' : seg.zone === 'good' ? '#5ABFA5' : '#3B4560',
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
