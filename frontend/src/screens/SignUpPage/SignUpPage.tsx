import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../services/api';
import { AlertTriangle } from 'lucide-react';

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get('email') ?? '';

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.signup({ email: email.trim().toLowerCase(), password });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 42,
    padding: '0 14px',
    background: '#1E2533',
    border: '0.5px solid #3B4560',
    borderRadius: 8,
    color: '#C8D0DC',
    outline: 'none',
    fontSize: 14,
  };

  if (success) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-main)',
          color: '#C8D0DC',
          flexDirection: 'column',
          gap: 12,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 500 }}>Check your email</div>
        <div style={{ fontSize: 13, color: '#9BA3B2', maxWidth: 360 }}>
          We sent a verification link to {email}. Click it to activate your account, then sign in.
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: 24 }}>
      <form
        onSubmit={onSubmit}
        style={{ width: 420, maxWidth: '100%', background: 'var(--bg-panel)', border: '0.5px solid #3B4560', borderRadius: 10, padding: 40, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ fontSize: 17, fontWeight: 500, color: '#C8D0DC', marginBottom: 8 }}>Complete your invite</div>

        {error && (
          <div style={{ background: 'rgba(240, 106, 80, 0.10)', border: '0.5px solid rgba(240, 106, 80, 0.30)', borderRadius: 6, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={16} color="#F06A50" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ color: '#F06A50', fontSize: 13, lineHeight: 1.35 }}>{error}</div>
          </div>
        )}

        <div>
          <div style={{ fontSize: 12, color: '#9BA3B2', fontWeight: 600, marginBottom: 6 }}>Work email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="engineer@company.com" style={inputStyle} autoComplete="email" />
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#9BA3B2', fontWeight: 600, marginBottom: 6 }}>Password</div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} autoComplete="new-password" />
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#9BA3B2', fontWeight: 600, marginBottom: 6 }}>Confirm password</div>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} autoComplete="new-password" />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{ marginTop: 8, width: '100%', height: 42, background: '#1E2533', border: '0.5px solid #3B4560', borderRadius: 8, color: '#C8D0DC', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          {submitting ? 'Creating account...' : 'Create account'}
        </button>

        <div style={{ marginTop: 4, textAlign: 'center', fontSize: 12, color: '#378ADD', cursor: 'pointer' }} onClick={() => navigate('/login')}>
          Already have an account? Sign in
        </div>
      </form>
    </div>
  );
};
