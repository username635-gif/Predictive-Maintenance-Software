import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../services/api';

type VerifyState = 'loading' | 'success' | 'error';

export const VerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<VerifyState>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const email = searchParams.get('email');
    const token = searchParams.get('token');

    if (!email || !token) {
      setState('error');
      setMessage('This verification link is missing required information.');
      return;
    }

    api
      .verify({ email, token })
      .then(() => {
        setState('success');
        setMessage('Your email is verified. You can now sign in.');
      })
      .catch((err) => {
        setState('error');
        setMessage(err instanceof ApiError ? err.message : 'Could not verify this link.');
      });
  }, [searchParams]);

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
        gap: 16,
        padding: 24,
        textAlign: 'center',
      }}
    >
      {state === 'loading' && <div>Verifying...</div>}
      {state !== 'loading' && (
        <>
          <div style={{ fontSize: 16, color: state === 'success' ? '#C8D0DC' : '#F06A50' }}>{message}</div>
          {state === 'success' && (
            <div style={{ fontSize: 13, color: '#378ADD', cursor: 'pointer' }} onClick={() => navigate('/login')}>
              Go to sign in
            </div>
          )}
        </>
      )}
    </div>
  );
};
