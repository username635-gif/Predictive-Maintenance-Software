import React, { useState } from 'react';
import type { PredictionResult } from '../../types';
import { RULGauge } from './RULGauge';
import { severityColor } from '../../utils/colors';
import { fmt } from '../../utils/formatting';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

interface PredictionCardProps {
  prediction: PredictionResult;
  onCreateWorkOrder: () => void;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({ prediction, onCreateWorkOrder }) => {
  const [showExplain, setShowExplain] = useState(false);

  const color = severityColor(prediction.severity);


  return (
    <div style={{
      background: 'var(--bg-panel-alt)',
      border: `1px solid ${color}40`,
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      {/* Header */}
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
            {fmt(prediction.created_at, 'HH:mm dd MMM')} · Model v{prediction.model_version}
          </div>
        </div>
        <div style={{
          background: `${color}25`,
          border: `1px solid ${color}50`,
          borderRadius: '3px', padding: '3px 8px',
          fontSize: '11px', fontWeight: 700, color,
          textTransform: 'uppercase' as const,
        }}>
          {prediction.severity}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        {/* RUL Gauge + root cause */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
          <div style={{ flexShrink: 0 }}>
            <RULGauge
              days={prediction.rul_days}
              lower={prediction.rul_lower}
              upper={prediction.rul_upper}
              size={80}
              model_metadata={prediction.model_metadata}
            />

          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>PRIMARY FAILURE MODE</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {prediction.primary_failure_mode}
            </div>
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>ROOT CAUSE PROBABILITY</div>
              {prediction.root_cause.map((rc, i) => (
                <div key={i} style={{ marginBottom: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{rc.icon} {rc.cause}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '11px',
                      color: i === 0 ? color : 'var(--text-muted)',
                      fontWeight: i === 0 ? 700 : 400,
                    }}>
                      {Math.round(rc.probability * 100)}%
                    </span>
                  </div>
                  <div style={{ height: '3px', background: '#2D2D2D', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '2px',
                      width: `${rc.probability * 100}%`,
                      background: i === 0 ? color : '#454C52',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Anomaly score */}
        <div style={{
          display: 'flex', gap: '12px', padding: '8px',
          background: '#1A1C1F', borderRadius: '4px', marginBottom: '10px',
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color }}>
              {Math.round(prediction.anomaly_score * 100)}%
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Anomaly Score</div>
          </div>
          <div style={{ width: '1px', background: 'var(--border)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: '#30A46C' }}>
              {Math.round(prediction.confidence * 100)}%
            </div>
            {prediction.model_metadata?.validated === false && (
              <div style={{
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span
                  style={{
                    background: '#FFB02018',
                    border: '1px solid #FFB020',
                    color: '#FFB020',
                    borderRadius: 999,
                    padding: '2px 8px',
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                  }}
                >
                  Unvalidated model — synthetic training data
                </span>
              </div>
            )}
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: prediction.model_metadata?.validated === false ? 6 : 0 }}>
              Model Confidence
            </div>
          </div>

        </div>

        {/* EXPLAIN button */}
        <button
          className="btn btn-ghost"
          onClick={() => setShowExplain(!showExplain)}
          style={{
            width: '100%', justifyContent: 'space-between',
            background: showExplain ? 'var(--color-info-dim)' : 'var(--bg-hover)',
            borderColor: showExplain ? 'var(--color-info)' : 'var(--border)',
            color: 'var(--text-primary)', minHeight: '36px', height: 'auto',
            padding: '6px 10px', fontSize: '12px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
            <Info size={13} color={showExplain ? '#0090FF' : '#858C94'} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong>EXPLAIN</strong> – Why is this segment at risk?
            </span>
          </span>
          <span style={{ flexShrink: 0, marginLeft: '6px' }}>
            {showExplain ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </button>

        {/* Explain panel */}
        {showExplain && (
          <div className="animate-fade-in" style={{
            marginTop: '8px', padding: '12px',
            background: '#12141A', borderRadius: '6px',
            border: '1px solid var(--color-info-dim)',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-info)', marginBottom: '10px', letterSpacing: '0.5px' }}>
              TOP CONTRIBUTING FACTORS
            </div>
            {prediction.explanation.map((feat, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {feat.feature}
                    </span>
                    <span style={{
                      marginLeft: '8px', fontSize: '11px',
                      fontFamily: 'var(--font-mono)', color: '#FF851B',
                    }}>
                      {feat.value}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700,
                    color: feat.contribution > 40 ? '#FF4136' : feat.contribution > 25 ? '#FF851B' : '#FFDC00',
                  }}>
                    {feat.contribution}%
                  </span>
                </div>
                <div style={{ height: '4px', background: '#2D2D2D', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' }}>
                  <div style={{
                    height: '100%', borderRadius: '2px',
                    width: `${feat.contribution}%`,
                    background: feat.contribution > 40 ? '#FF4136' : feat.contribution > 25 ? '#FF851B' : '#FFDC00',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {feat.plain_english}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
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
