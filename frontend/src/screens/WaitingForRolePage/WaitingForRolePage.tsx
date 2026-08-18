import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { setRosSession } from '../../auth/rosSession';

export const WaitingForRolePage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const me = await api.getMe();
        if (cancelled) return;
        if (me.status === 'active' && me.token) {
          setRosSession({
            token: me.token,
            user: { id: me.user.id, email: me.user.email, name: me.user.name, role: me.user.role },
            status: 'active',
          });
          navigate('/map', { replace: true });
        }
      } catch {
        // 401 (session expiry) is already handled globally by api.ts --
        // just surface anything else quietly, don't spam the user.
        if (!cancelled) setError('Could not check status. Retrying...');
      }
    };

    poll();
    const interval = setInterval(poll, 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [navigate]);

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
      <div style={{ fontSize: 18, fontWeight: 500 }}>Waiting for role assignment</div>
      <div style={{ fontSize: 13, color: '#9BA3B2', maxWidth: 360 }}>
        Your account is verified. An administrator needs to assign you a role before you can access
        ReliabilityOS. This page will update automatically once that happens.
      </div>
      {error && <div style={{ fontSize: 12, color: '#F06A50' }}>{error}</div>}
    </div>
  );
};
