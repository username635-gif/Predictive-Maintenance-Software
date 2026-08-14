import React from 'react';
import type { Sensor } from '../../types';
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

      {/* Sparkline removed -- no real per-sensor history reaches the
          frontend yet (see comment above). */}
      <div style={{
        height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '4px',
      }}>
        History not yet available
      </div>

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
