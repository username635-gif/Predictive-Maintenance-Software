import React from 'react';

import type { ModelMetadata } from '../../types';

interface RULGaugeProps {
  days: number;
  lower: number;
  upper: number;
  size?: number;
  model_metadata?: ModelMetadata;
}


/**
 * SVG arc gauge – shows remaining useful life in days.
 * Green > 60d, Yellow 30–60, Orange 14–30, Red < 14.
 */
export const RULGauge: React.FC<RULGaugeProps> = ({ days, lower, upper, size = 100, model_metadata }) => {

  const MAX_DAYS = 120;
  const pct = Math.min(days / MAX_DAYS, 1);

  const cx = size / 2;
  const cy = size / 2 + 4;
  const r  = size * 0.38;
  const startAngle = -210;
  const endAngle   = 30;
  const totalAngle = endAngle - startAngle;
  const sweepAngle = pct * totalAngle;

  function polar(angle: number): { x: number; y: number } {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const trackStart = polar(startAngle);
  const trackEnd   = polar(endAngle);
  const arcStart   = polar(startAngle);
  const arcEnd     = polar(startAngle + sweepAngle);

  const trackPath = `M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 1 1 ${trackEnd.x} ${trackEnd.y}`;
  const arcPath   = sweepAngle === 0
    ? ''
    : `M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${sweepAngle > 180 ? 1 : 0} 1 ${arcEnd.x} ${arcEnd.y}`;

  const color = days === 0 ? '#FF4136' :
                days < 14  ? '#FF4136' :
                days < 30  ? '#FF851B' :
                days < 60  ? '#FFDC00' :
                             '#2ECC40';

  const label = days === 0 ? 'NOW' : `${days}d`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <path d={trackPath} fill="none" stroke="#2D2D2D" strokeWidth={6} strokeLinecap="round" />

      {/* Fill arc */}
      {arcPath && (
        <path d={arcPath} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
          style={{ filter: days < 30 ? `drop-shadow(0 0 4px ${color})` : 'none' }}
        />
      )}

      {/* Value */}
      <text
        x={cx} y={cy - 4}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={days === 0 ? 14 : 18} fontWeight={700}
        fill={color} fontFamily="'SF Mono', monospace"
      >{label}</text>

      {/* Sub-label */}
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={9} fill="#6B6E7A">
        {days === 0 ? 'ACTIVE FAILURE' : 'est. remaining life'}
      </text>

      {/* CI range */}
      <text x={cx} y={cy + 26} textAnchor="middle" fontSize={8} fill="#4A4D56">
        {lower}–{upper}d (90% CI)
      </text>

      {/* Provenance label (if provided) */}
      {model_metadata?.validated === false && (
        <g>
          <text x={cx} y={cy + 36} textAnchor="middle" fontSize={7} fill="#FFB020">
            Unvalidated model — synthetic training data
          </text>
        </g>
      )}


      {/* Min/Max ticks */}
      <text x={trackStart.x - 4} y={trackStart.y + 2} fontSize={8} fill="#3A3D48" textAnchor="end">0</text>
      <text x={trackEnd.x + 4}   y={trackEnd.y + 2}   fontSize={8} fill="#3A3D48" textAnchor="start">{MAX_DAYS}+</text>
    </svg>
  );
};
