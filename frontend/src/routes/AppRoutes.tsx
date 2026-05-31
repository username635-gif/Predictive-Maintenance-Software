import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SignInPage } from '../screens/SignInPage/SignInPage';
import { AppShell } from './AppShell';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<SignInPage />} />
      <Route path="/" element={<Navigate to="/map" replace />} />
      <Route path="/map" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/map" replace />} />
    </Routes>
  );
};

