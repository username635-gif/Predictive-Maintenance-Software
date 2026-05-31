import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getRosSession } from '../auth/rosSession';

export const AuthGuard: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const session = getRosSession();
  const location = useLocation();

  // Allow unauthenticated users to access the login page.
  // main.tsx wraps <AppRoutes/> with this guard, so without this check `/login` would be blocked.
  const isLoginRoute = location.pathname === '/login';

  if (!session) {
    if (isLoginRoute) return children;
    return <Navigate to={`/login?reason=timeout`} replace />;
  }

  return children;
};


