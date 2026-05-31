import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setRosSession } from '../../auth/rosSession';

const styles = {
  page: {
    height: '100vh',
    width: '100vw',
    maxWidth: '100vw',
    maxHeight: '100vh',
    background: 'var(--bg-main)',
    color: 'var(--text-primary)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  top: {
    height: 'var(--topbar-height)',
    background: '#13161F',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    flexShrink: 0,
  },
  banner: {
    height: 'var(--banner-height)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(212, 162, 75, 0.08)',
    border: '0.5px solid rgba(212, 162, 75, 0.3)',
    color: '#D4A24B',
    fontSize: '12px',
    letterSpacing: '0.2px',
    flexShrink: 0,
  },
  contentWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    minHeight: 0,
  },
  card: {
    width: '420px',
    maxWidth: '100%',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '18px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '12px',
    letterSpacing: '0.2px',
  },
  row: { display: 'flex', flexDirection: 'column' as const, gap: '8px', marginBottom: '12px' },
  label: { fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 },
  input: {
    height: '40px',
    borderRadius: '4px',
    background: '#0F1117',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    padding: '0 12px',
    outline: 'none',
    fontFamily: 'var(--font-mono)',
  } as React.CSSProperties,
  hint: { fontSize: '11px', color: 'var(--text-muted)' },
};

export const SignInPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const reason = useMemo(() => new URLSearchParams(location.search).get('reason'), [location.search]);
  const showTimeoutBanner = reason === 'timeout';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Internal tool: simulate authentication.
    setSubmitting(true);
    try {
      setRosSession({ authenticated: true, role: 'engineer' });
      navigate('/map', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <header style={styles.top}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: '#0090FF',
              boxShadow: '0 0 0 2px rgba(0,144,255,0.12)',
            }}
          />
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#E8ECEF' }}>
            Reliability<span style={{ color: '#0090FF' }}>OS</span>
          </span>
          <span
            style={{
              fontSize: '10px',
              color: '#5A6069',
              background: '#25282B',
              border: '1px solid #2D2D2D',
              borderRadius: '2px',
              padding: '1px 5px',
              fontFamily: 'var(--font-mono)',
              marginLeft: 8,
            }}
          >
            ENTERPRISE
          </span>
        </div>
      </header>

      {showTimeoutBanner && <div style={styles.banner}>Your session has expired. Please sign in again.</div>}

      <div style={styles.contentWrap}>
        <form style={styles.card} onSubmit={onSubmit}>
          <div style={styles.title}>Sign in</div>

          <div style={styles.row}>
            <div style={styles.label}>USERNAME</div>
            <input
              style={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              spellCheck={false}
            />
          </div>

          <div style={styles.row}>
            <div style={styles.label}>PASSWORD</div>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              spellCheck={false}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting || username.trim().length === 0 || password.length === 0}
              style={{ flex: 1, minWidth: 0 }}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </div>

          <div style={styles.hint}>
            Credentials are validated internally. This page is restricted to engineering and operations staff.
          </div>
        </form>
      </div>
    </div>
  );
};

