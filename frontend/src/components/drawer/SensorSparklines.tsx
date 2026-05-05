import React from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import type { Sensor } from '../../types';
import { sensorTypeLabel } from '../../utils/formatting';

interface SparklineProps {
  sensor: Sensor;
}

export const SensorSparkline: React.FC<SparklineProps> = ({ sensor }) => {
  const isOutOfRange = sensor.last_reading
    ? (sensor.last_reading.value < sensor.normal_range[0] ||
       sensor.last_reading.value > sensor.normal_range[1])
    : false;

  const color = sensor.status === 'offline' ? '#5A5F66' :
                isOutOfRange ? '#E5484D' :
                sensor.status === 'degraded' ? '#F76808' : '#0090FF';

  return (
    <div style={{
      background: '#1A1C23',
      border: `1px solid ${isOutOfRange ? '#E5484D30' : 'var(--border)'}`,
      borderRadius: '5px',
      padding: '8px 10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {sensorTypeLabel(sensor.type)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {sensor.id} · Mile {sensor.mile_marker}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color,
          }}>
            {sensor.last_reading?.value.toFixed(2)} {sensor.unit}
          </div>
          <div style={{
            fontSize: '9px',
            color: sensor.status === 'online' ? '#30A46C' : '#F76808',
          }}>
            {sensor.status}
          </div>
        </div>
      </div>

      {/* Mini sparkline */}
      <div style={{ height: '36px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sensor.history}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Tooltip
              contentStyle={{
                background: '#252830', border: '1px solid #3A3D48',
                borderRadius: '4px', padding: '4px 8px', fontSize: '10px',
              }}
              itemStyle={{ color: '#E8ECEF' }}
              formatter={(v: number) => [`${v.toFixed(2)} ${sensor.unit}`, '']}
              labelFormatter={() => ''}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Normal range indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
        <span style={{ fontSize: '9px', color: '#3A3D48' }}>
          Normal: {sensor.normal_range[0]}–{sensor.normal_range[1]} {sensor.unit}
        </span>
        {isOutOfRange && (
          <span style={{ fontSize: '9px', color: '#E5484D', fontWeight: 600 }}>OUT OF RANGE</span>
        )}
      </div>
    </div>
  );
};
