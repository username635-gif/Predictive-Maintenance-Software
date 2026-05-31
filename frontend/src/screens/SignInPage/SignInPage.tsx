import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setRosSession } from '../../auth/rosSession';


const styles = {
  page: {
    height: '100vh',
    width: '100vw',
    maxWidth: '100vw',
    maxHeight: '100vh',
    background: '#0F1117',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  card: {
    width: '420px',
    background: '#161B24',
    border: '0.5px solid #3B4560',
    borderRadius: '10px',
    padding: '40px',
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
  const navigate = useNavigate();


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
      <form className="animate-login-card-fade" style={styles.card} onSubmit={onSubmit}>
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
  );
};


