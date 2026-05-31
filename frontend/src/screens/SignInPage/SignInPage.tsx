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

  header: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: '6px',
    marginBottom: '28px',
  },

  headerLine1: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  headerReliabilityOS: {
    fontSize: '17px',
    fontWeight: 500,
    color: '#C8D0DC',
    letterSpacing: '0.1px',
    lineHeight: 1.2,
  },

  headerLine2: {
    fontSize: '12px',
    color: '#9BA3B2',
    lineHeight: 1.2,
  },

  headerLine3: {
    fontSize: '11px',
    color: '#6B7280',
    lineHeight: 1.2,
  },

  headerDivider: {
    height: '0.5px',
    background: '#3B4560',
    width: '100%',
    marginTop: '8px',
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
        <div style={styles.header}>
          <div style={styles.headerLine1}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 9.2C5.1 9.2 5.1 5.1 7.2 5.1C9.3 5.1 9.3 9.2 11.4 9.2C13.5 9.2 13.5 12.9 15.6 12.9"
                stroke="#378ADD"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <animate
                  attributeName="d"
                  dur="1.6s"
                  repeatCount="indefinite"
                  values="M3 9.2C5.1 9.2 5.1 5.1 7.2 5.1C9.3 5.1 9.3 9.2 11.4 9.2C13.5 9.2 13.5 12.9 15.6 12.9;M3 9.2C5.1 9.2 5.1 12.5 7.2 12.5C9.3 12.5 9.3 7.9 11.4 7.9C13.5 7.9 13.5 4.9 15.6 4.9"
                />
              </path>
              <circle cx="9" cy="9" r="1.1" fill="#378ADD">
                <animate attributeName="r" dur="1.6s" repeatCount="indefinite" values="0.9;1.4;0.9" />
                <animate attributeName="opacity" dur="1.6s" repeatCount="indefinite" values="0.8;1;0.8" />
              </circle>
            </svg>
            <span style={styles.headerReliabilityOS}>ReliabilityOS</span>
          </div>
          <div style={styles.headerLine2}>Permian 500 · Pipeline Integrity Platform</div>
          <div style={styles.headerLine3}>Authorized personnel only</div>
          <div style={styles.headerDivider} />
        </div>

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


