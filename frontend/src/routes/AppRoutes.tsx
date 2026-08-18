import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SignInPage } from '../screens/SignInPage/SignInPage';
import { SignUpPage } from '../screens/SignUpPage/SignUpPage';
import { VerifyPage } from '../screens/VerifyPage/VerifyPage';
import { WaitingForRolePage } from '../screens/WaitingForRolePage/WaitingForRolePage';
import { AppShell } from './AppShell';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/waiting-for-role" element={<WaitingForRolePage />} />
      <Route path="/" element={<Navigate to="/map" replace />} />
      <Route path="/map" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/map" replace />} />
    </Routes>
  );
};
