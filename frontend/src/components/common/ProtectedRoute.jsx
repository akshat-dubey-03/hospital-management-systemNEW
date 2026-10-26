// src/components/common/ProtectedRoute.jsx
// Wraps routes that require authentication.
// Redirects unauthenticated users to the appropriate login page.
// Also handles role-based redirection.

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import AppNavbar from './AppNavbar.jsx';

const ROLE_HOME = {
  PATIENT: '/patient/dashboard',
  DOCTOR:  '/doctor/dashboard',
  ADMIN:   '/admin/dashboard',
};

/**
 * @param {{ children: React.ReactNode, role?: string }} props
 */
export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to appropriate login page, preserving intended destination
    const loginPath = role === 'DOCTOR' ? '/doctor/login' :
                      role === 'ADMIN'  ? '/admin/login'  : '/login';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // If a specific role is required and user has a different role, redirect to their home
  if (role && user?.role !== role) {
    return <Navigate to={ROLE_HOME[user?.role] || '/'} replace />;
  }

  return (
    <>
      <AppNavbar />
      {children}
    </>
  );
}
