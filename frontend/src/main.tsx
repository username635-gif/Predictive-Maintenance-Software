import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { AppRoutes } from './routes/AppRoutes';
import { AuthGuard } from './routes/AuthGuard';


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Route-level guard: wrap protected content */}
      <AuthGuard>
        {/* AuthGuard redirects when no valid session exists */}
        <div style={{ display: 'contents' }}>
          <AppRoutes />
          {/* AppShell is mounted by /map route; guard applies globally via AuthGuard's redirection */}
        </div>
      </AuthGuard>
    </BrowserRouter>
  </React.StrictMode>
);

