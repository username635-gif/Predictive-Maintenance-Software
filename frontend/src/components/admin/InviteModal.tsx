import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { api, ApiError } from '../../services/api';
import type { UserRole } from '../../auth/rosSession';

type RoleOption = UserRole | '';

export const InviteModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<RoleOption>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  const resetForm = () => {
    setEmail('');
    setName('');
    setRole('');
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      setError('Email and name are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.invite({ email: email.trim(), name: name.trim(), role: role || undefined });
      setSuccessEmail(email.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send invite.');
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
        width: '440px', maxWidth: '95vw', maxHeight: '85vh',
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
            <UserPlus size={16} color="#0078D4" />
            <h2>Invite User</h2>
          </div>
          <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {successEmail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14, color: '#30A46C' }}>
                Invite sent to {successEmail}.
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                They can sign up with this email. Verification links are logged server-side for now (email sending not yet wired).
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setSuccessEmail(null); resetForm(); }}
                >
                  Invite another
                </button>
                <button type="button" className="btn btn-sm" onClick={onClose}>Done</button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    height: 34, borderRadius: 4, border: '1px solid var(--border)',
                    background: 'var(--bg-main)', color: 'var(--text-primary)', padding: '0 10px', fontSize: 13,
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    height: 34, borderRadius: 4, border: '1px solid var(--border)',
                    background: 'var(--bg-main)', color: 'var(--text-primary)', padding: '0 10px', fontSize: 13,
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                Role (optional — leave unassigned to decide later)
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleOption)}
                  style={{
                    height: 34, borderRadius: 4, border: '1px solid var(--border)',
                    background: 'var(--bg-main)', color: 'var(--text-primary)', padding: '0 10px', fontSize: 13,
                  }}
                >
                  <option value="">Unassigned</option>
                  <option value="technician">Technician</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </label>

              {error && <div style={{ fontSize: 12, color: '#F06A50' }}>{error}</div>}

              <button type="submit" className="btn btn-sm" disabled={submitting} style={{ marginTop: 4 }}>
                {submitting ? 'Sending...' : 'Send Invite'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
export default InviteModal;
