import React from 'react';
import { Navigate } from 'react-router-dom';
import { getRosSession } from '../auth/rosSession';


export const AuthGuard: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const session = getRosSession();


  if (!session) {
    return <Navigate to={`/login?reason=timeout`} replace />;
  }

  return children;
};

