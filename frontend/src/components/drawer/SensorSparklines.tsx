import React, { useEffect, useState } from 'react';
import type { Sensor } from '../../types';
import { api } from '../../services/api';
import { sensorTypeLabel } from '../../utils/formatting';

interface SparklineProps {
  sensor: Sensor;
}

// Rebuilt against the real Sensor shape. No normal_range/last_reading/
// mile_marker/history/type fields exist on the real schema -- using
// hard_min/hard_max (or manual_override_min/max when set) as the real
// range, last_value as the current reading, sensor_type/asset_name as
// labels. The sparkline chart is removed: nothing currently fetches
// per-sensor historical readings to the frontend (sensor_readings table
// exists server-side but isn't wired here yet) -- a real gap, not faked
// with a flat line.
export const SensorSparkline: React.FC<SparklineProps> = ({ sensor }) => {
  const [history, setHistory] = useState<{ reading_at: string; value: number }[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.getSensorHistory(sensor.id, 24)
      .then((res) => { if (!cancelled) setHistory(res.readings); })
      .catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [sensor.id]);
  const rangeMin = sensor.manual_override_min ?? sensor.hard_min;
  const rangeMax = sensor.manual_override_max ?? sensor.hard_max;

  const isOutOfRange =
    sensor.last_value !== null && rangeMin !== null && rangeMax !== null
      ? sensor.last_value < rangeMin || sensor.last_value > rangeMax
      : false;

  const color =
    sensor.status === 'offline' ? '#5A5F66' :
    isOutOfRange ? '#E5484D' :
    '#0090FF';

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
            {sensorTypeLabel(sensor.sensor_type)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {sensor.id}{sensor.asset_name ? ` - ${sensor.asset_name}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color,
          }}>
            {sensor.last_value !== null ? sensor.last_value.toFixed(2) : '-'} {sensor.unit}
          </div>
          <div style={{
            fontSize: '9px',
            color: sensor.status === 'online' ? '#30A46C' : '#F76808',
          }}>
            {sensor.status}
          </div>
        </div>
      </div>
      {history === null ? (
        <div style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : history.length === 0 ? (
        <div style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '4px' }}>No history yet</div>
      ) : (
        <svg viewBox='0 0 200 36' style={{ width: '100%', height: '36px' }} preserveAspectRatio='none'>
          <polyline
            fill='none'
            stroke={color}
            strokeWidth='1.5'
            points={history.map((r, i) => {
              const vals = history.map(h => h.value);
              const min = Math.min(...vals);
              const max = Math.max(...vals);
              const range = max - min || 1;
              const x = (i / Math.max(history.length - 1, 1)) * 200;
              const y = 34 - ((r.value - min) / range) * 32;
              return x + "," + y;
            }).join(' ')}
          />
        </svg>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
        <span style={{ fontSize: '9px', color: '#3A3D48' }}>
          {rangeMin !== null && rangeMax !== null
            ? `Normal: ${rangeMin}-${rangeMax} ${sensor.unit}`
            : 'Normal range not set'}
        </span>
        {isOutOfRange && (
          <span style={{ fontSize: '9px', color: '#E5484D', fontWeight: 600 }}>OUT OF RANGE</span>
        )}
      </div>
    </div>
  );
};
