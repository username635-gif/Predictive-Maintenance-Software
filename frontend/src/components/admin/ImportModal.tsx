import React, { useState } from 'react';
import { X, UploadCloud } from 'lucide-react';
import { api, ApiError, ImportResult } from '../../services/api';

type ImportKind = 'sensor-readings' | 'asset-specs' | 'incidents';

const KIND_LABELS: Record<ImportKind, string> = {
  'sensor-readings': 'Sensor Readings',
  'asset-specs': 'Asset / Pipe Specs',
  'incidents': 'Incident / Failure Log',
};

const KIND_COLUMNS: Record<ImportKind, string> = {
  'sensor-readings': 'sensor_id, timestamp, value, unit, quality_flag',
  'asset-specs': 'asset_id, material, diameter_inches, install_year, ...',
  'incidents': 'asset_id, event_timestamp, event_type, description',
};

export const ImportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [kind, setKind] = useState<ImportKind>('sensor-readings');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setFile(null);
    setError(null);
    setResult(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Choose a CSV file first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fn =
        kind === 'sensor-readings' ? api.importSensorReadings :
        kind === 'asset-specs' ? api.importAssetSpecs :
        api.importIncidents;
      const res = await fn(file);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }}>
      <div className="animate-fade-in" style={{
        width: '520px', maxWidth: '95vw', maxHeight: '85vh',
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: '8px', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, background: '#1A1C23',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UploadCloud size={16} color="#0078D4" />
            <h2>Import Vendor Data</h2>
          </div>
          <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14, color: result.error_count > 0 ? '#D4A24B' : '#30A46C' }}>
                {result.inserted !== undefined && `${result.inserted} of ${result.total_rows} rows inserted.`}
                {result.updated !== undefined && `${result.updated} of ${result.total_rows} rows updated.`}
              </div>
              {result.error_count > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>{result.error_count} row(s) had errors:</div>
                  <div style={{
                    maxHeight: 180, overflowY: 'auto', background: 'var(--bg-main)',
                    border: '1px solid var(--border)', borderRadius: 4, padding: 8,
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                  }}>
                    {result.errors.map((e, i) => (
                      <div key={i} style={{ color: '#F06A50' }}>Row {e.row}: {e.error}</div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
                  Import another file
                </button>
                <button type="button" className="btn btn-sm" onClick={onClose}>Done</button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                Data type
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as ImportKind)}
                  style={{
                    height: 34, borderRadius: 4, border: '1px solid var(--border)',
                    background: 'var(--bg-main)', color: 'var(--text-primary)', padding: '0 10px', fontSize: 13,
                  }}
                >
                  {(Object.keys(KIND_LABELS) as ImportKind[]).map((k) => (
                    <option key={k} value={k}>{KIND_LABELS[k]}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Columns: {KIND_COLUMNS[kind]}
                </span>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                CSV file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  style={{
                    border: '1px solid var(--border)', borderRadius: 4,
                    background: 'var(--bg-main)', color: 'var(--text-primary)', padding: '8px 10px', fontSize: 13,
                  }}
                />
              </label>

              {error && <div style={{ fontSize: 12, color: '#F06A50' }}>{error}</div>}

              <button type="submit" className="btn btn-sm" disabled={submitting} style={{ marginTop: 4 }}>
                {submitting ? 'Uploading...' : 'Upload & Import'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
