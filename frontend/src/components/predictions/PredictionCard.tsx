import React from 'react';
import type { PredictionResult } from '../../types';
import { RULGauge } from './RULGauge';
import { severityColor } from '../../utils/colors';
import { fmt } from '../../utils/formatting';

interface PredictionCardProps {
  prediction: PredictionResult;
  onCreateWorkOrder: () => void;
}

// Rebuilt against the real PredictionResult shape. confidence, root_cause,
// explanation, primary_failure_mode, and model_metadata do not exist on
// the real schema -- removed rather than faked. The predictions table is
// legitimately empty right now (no ML service writes to it yet, see
// backend/api/src/routes/predictions.ts), so this card mostly exists for
// when that data starts arriving.
export const PredictionCard: React.FC<PredictionCardProps> = ({ prediction, onCreateWorkOrder }) => {
  const color = severityColor(prediction.severity ?? 'medium');
  const hasRul = prediction.rul_days !== null && prediction.rul_lower !== null && prediction.rul_upper !== null;

  return (
    <div style={{
      background: 'var(--bg-panel-alt)',
      border: `1px solid ${color}40`,
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      <div style={{
        background: `${color}18`,
        padding: '10px 14px',
        borderBottom: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '12px', color }}>
            AI PREDICTION
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
            {fmt(prediction.created_at, 'HH:mm dd MMM')}{prediction.model_version ? ` - Model ${prediction.model_version}` : ''}
          </div>
        </div>
        <div style={{
          background: `${color}25`,
          border: `1px solid ${color}50`,
          borderRadius: '3px', padding: '3px 8px',
          fontSize: '11px', fontWeight: 700, color,
          textTransform: 'uppercase' as const,
        }}>
          {prediction.severity ?? 'unknown'}
        </div>
      </div>

      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
          {hasRul && (
            <div style={{ flexShrink: 0 }}>
              <RULGauge
                days={prediction.rul_days as number}
                lower={prediction.rul_lower as number}
                upper={prediction.rul_upper as number}
                size={80}
              />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>FAILURE MODE</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {prediction.failure_mode ?? 'Not specified'}
            </div>
            {!hasRul && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                RUL estimate not available for this prediction.
              </div>
            )}
          </div>
        </div>

        <div style={{
          display: 'flex', gap: '12px', padding: '8px',
          background: '#1A1C1F', borderRadius: '4px', marginBottom: '10px',
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color }}>
              {prediction.anomaly_score !== null ? `${Math.round(prediction.anomaly_score * 100)}%` : '-'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Anomaly Score</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button className="btn btn-primary" onClick={onCreateWorkOrder} style={{ flex: 1, fontSize: '12px' }}>
            Create Work Order
          </button>
          {prediction.severity === 'critical' && (
            <button className="btn btn-destruct" style={{ fontSize: '12px', padding: '0 12px' }}>
              Escalate
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
