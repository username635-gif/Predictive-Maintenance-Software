import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getRosSession } from '../auth/rosSession';

export const AuthGuard: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const session = getRosSession();
  const location = useLocation();

  // Allow unauthenticated users to access login/signup/verify.
  // main.tsx wraps <AppRoutes/> with this guard, so without this check
  // those routes would be blocked.
  const publicPaths = ['/login', '/signup', '/verify'];
  const isPublicRoute = publicPaths.includes(location.pathname);

  if (!session) {
    if (isPublicRoute) return children;
    return <Navigate to={`/login?reason=timeout`} replace />;
  }

  // Pending users (verified, no role assigned yet) can only see the
  // waiting screen -- redirect them there from anywhere else. An active
  // user who somehow lands on the waiting screen gets sent to the app.
  const isWaitingRoute = location.pathname === '/waiting-for-role';
  if (session.status === 'pending' && !isWaitingRoute) {
    return <Navigate to="/waiting-for-role" replace />;
  }
  if (session.status === 'active' && isWaitingRoute) {
    return <Navigate to="/map" replace />;
  }

  return children;
};
