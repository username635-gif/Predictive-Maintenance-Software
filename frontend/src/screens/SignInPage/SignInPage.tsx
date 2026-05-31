import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setRosSession } from '../../auth/rosSession';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';

const COLORS = {
  dividerLine: '#3B4560',
  dividerText: '#6B7280',
  label: '#9BA3B2',
  placeholder: '#6B7280',
  inputText: '#C8D0DC',
  inputBg: '#1E2533',
  focusBorder: '#378ADD',
  border: '#3B4560',
  errorBg: 'rgba(240, 106, 80, 0.10)',
  errorBorder: 'rgba(240, 106, 80, 0.30)',
  errorText: '#F06A50',
  buttonBg: '#1E2533',
  buttonHoverBg: '#2A3245',
};

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const inputBase = useMemo(() => {
    return {
      width: '100%',
      height: 42,
      padding: '0 14px',
      background: COLORS.inputBg,
      border: '0.5px solid ' + COLORS.border,
      borderRadius: 8,
      color: COLORS.inputText,
      outline: 'none',
      fontFamily: 'var(--font-mono)',
      fontSize: 14,
      boxShadow: 'none',
    } as const;
  }, []);

  const onDemoSuccess = () => {
    // DEMO AUTH — replace with real SSO and API calls in production
    setRosSession({ authenticated: true, role: 'engineer' });
    navigate('/map', { replace: true });
  };

  const onSubmitEmailPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      // DEMO AUTH — replace with real SSO and API calls in production
      const emailOk = email.includes('@');
      const passwordOk = password.trim().length >= 6;

      if (emailOk && passwordOk) {
        setError(false);
        onDemoSuccess();
        return;
      }

      // Any other input => show error state
      setError(true);
      // On error: clear password only, keep email populated
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = {
    page: {
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100vw',
      background: 'var(--bg-main)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px 16px',
      overflow: 'hidden',
    } as React.CSSProperties,
    column: {
      width: 420,
      maxWidth: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
    } as React.CSSProperties,
    card: {
      width: '100%',
      background: 'var(--bg-panel)',
      border: '0.5px solid ' + COLORS.border,
      borderRadius: 10,
      padding: 40,
    } as React.CSSProperties,
    header: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'flex-start',
      gap: 6,
      marginBottom: 28,
    } as React.CSSProperties,
    headerLine1: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    } as React.CSSProperties,
    headerReliabilityOS: {
      fontSize: 17,
      fontWeight: 500,
      color: '#C8D0DC',
      letterSpacing: '0.1px',
      lineHeight: 1.2,
    } as React.CSSProperties,
    headerLine2: {
      fontSize: 12,
      color: '#9BA3B2',
      lineHeight: 1.2,
    } as React.CSSProperties,
    headerLine3: {
      fontSize: 11,
      color: '#6B7280',
      lineHeight: 1.2,
    } as React.CSSProperties,
    headerDivider: {
      height: 0.5,
      background: COLORS.border,
      width: '100%',
      marginTop: 8,
    } as React.CSSProperties,

    field: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 6,
      marginTop: 0,
    } as React.CSSProperties,
    label: {
      fontSize: 12,
      color: COLORS.label,
      fontWeight: 600,
    } as React.CSSProperties,

    dividerWrap: {
      marginTop: 20,
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    } as React.CSSProperties,
    dividerLine: {
      height: 0.5,
      background: COLORS.dividerLine,
      flex: 1,
    } as React.CSSProperties,
    dividerText: {
      color: COLORS.dividerText,
      fontSize: 12,
      fontWeight: 600,
    } as React.CSSProperties,

    passwordRow: {
      position: 'relative',
      width: '100%',
    } as React.CSSProperties,
    passwordInput: {
      paddingRight: 46,
    } as React.CSSProperties,
    eyeButton: {
      position: 'absolute',
      right: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      height: 28,
      width: 28,
      borderRadius: 6,
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: COLORS.placeholder,
    } as React.CSSProperties,

    signInButton: {
      marginTop: 16,
      width: '100%',
      height: 42,
      background: COLORS.buttonBg,
      border: '0.5px solid ' + COLORS.border,
      borderRadius: 8,
      color: COLORS.inputText,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'background 0.15s, border-color 0.15s',
    } as React.CSSProperties,
    forgot: {
      marginTop: 10,
      width: '100%',
      textAlign: 'right' as const,
      fontSize: 12,
      color: COLORS.placeholder,
      textDecoration: 'none',
      cursor: 'pointer',
    } as React.CSSProperties,

    errorBox: {
      background: COLORS.errorBg,
      border: '0.5px solid ' + COLORS.errorBorder,
      borderRadius: 6,
      padding: '10px 14px',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      marginBottom: 12,
    } as React.CSSProperties,
    footer: {
      marginTop: 24,
      textAlign: 'center' as const,
      fontSize: 11,
      color: COLORS.placeholder,
      lineHeight: 1.6,
    } as React.CSSProperties,
  };

  return (
    <div style={styles.page}>
      <div style={styles.column}>
        <form className="animate-login-card-fade" style={styles.card} onSubmit={onSubmitEmailPassword}>
          <div style={styles.header}>
            <div style={styles.headerLine1}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
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

          {/* DEMO SSO Button */}
          <button
            type="button"
            style={{
              width: '100%',
              height: 42,
              background: '#378ADD',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#2E74BB';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#378ADD';
            }}
            aria-label="Sign in with Company SSO"
            onClick={() => {
              onDemoSuccess();
            }}
          >
            Sign in with Company SSO
          </button>

          <div style={styles.dividerWrap}>
            <div style={styles.dividerLine} />
            <div style={styles.dividerText}>or</div>
            <div style={styles.dividerLine} />
          </div>

          {error && (
            <div style={styles.errorBox} role="alert" aria-live="polite">
              <AlertTriangle size={16} color={COLORS.errorText} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ color: COLORS.errorText, fontSize: 13, lineHeight: 1.35 }}>
                Invalid credentials. Please sign in with your company account.
              </div>
            </div>
          )}

          <div style={styles.field}>
            <div style={styles.label}>Work email</div>
            <input
              style={inputBase}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(false);
              }}
              placeholder="engineer@company.com"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = COLORS.focusBorder;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = COLORS.border;
              }}
              autoComplete="email"
              spellCheck={false}
            />
          </div>

          <div style={{ ...styles.field, marginTop: 14 }}>
            <div style={styles.label}>Password</div>
            <div style={styles.passwordRow}>
              <input
                style={{ ...inputBase, ...styles.passwordInput }}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                placeholder={'•••••••'}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = COLORS.focusBorder;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = COLORS.border;
                }}
                autoComplete="current-password"
                spellCheck={false}
              />
              <button
                type="button"
                style={styles.eyeButton}
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} color={COLORS.placeholder} /> : <Eye size={18} color={COLORS.placeholder} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            style={styles.signInButton}
            disabled={submitting}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = COLORS.buttonHoverBg;
              (e.currentTarget as HTMLButtonElement).style.borderColor = COLORS.focusBorder;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = COLORS.buttonBg;
              (e.currentTarget as HTMLButtonElement).style.borderColor = COLORS.border;
            }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <div
            style={styles.forgot}
            role="button"
            tabIndex={0}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.color = '#9BA3B2';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.color = COLORS.placeholder;
            }}
          >
            Forgot password?
          </div>
        </form>

        {/* FOOTER — below card, not inside it */}
        <div style={styles.footer}>
          © 2026 ReliabilityOS · SOC 2 Type II Certified · PHMSA Compliant · For authorized use only
        </div>
      </div>
    </div>
  );
};



