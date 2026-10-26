// src/components/common/AppNavbar.jsx
// Top navigation for signed-in pages. Links are role-specific; the backend
// still enforces every permission — this only decides what is shown.

import { NavLink, useNavigate } from 'react-router-dom';
import { Heart, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const LINKS = {
  PATIENT: [
    { to: '/patient/dashboard', label: 'Dashboard' },
    { to: '/patient/doctors', label: 'Find Doctors' },
    { to: '/patient/appointments', label: 'Appointments' },
    { to: '/patient/records', label: 'Medical Records' },
    { to: '/patient/bills', label: 'Bills' },
    { to: '/patient/profile', label: 'Profile' },
  ],
  DOCTOR: [
    { to: '/doctor/dashboard', label: 'Dashboard' },
    { to: '/doctor/appointments', label: 'Appointments' },
    { to: '/doctor/patients', label: 'Patients' },
  ],
  ADMIN: [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/departments', label: 'Departments' },
    { to: '/admin/doctors', label: 'Doctors' },
    { to: '/admin/patients', label: 'Patients' },
    { to: '/admin/appointments', label: 'Appointments' },
    { to: '/admin/bills', label: 'Bills' },
  ],
};

const LOGIN_PATH = { PATIENT: '/login', DOCTOR: '/doctor/login', ADMIN: '/admin/login' };

export default function AppNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const name = user.firstName ? `${user.role === 'DOCTOR' ? 'Dr. ' : ''}${user.firstName} ${user.lastName ?? ''}`.trim() : user.email;

  async function handleLogout() {
    const role = user.role;
    await logout();
    navigate(LOGIN_PATH[role] || '/login', { replace: true });
  }

  return (
    <nav className="navbar app-navbar">
      <div className="navbar-inner app-navbar-inner">
        <div className="navbar-brand">
          <div className="navbar-brand-icon"><Heart size={18} /></div>
          <span>MediCore</span>
        </div>
        <div className="app-nav-links">
          {(LINKS[user.role] || []).map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to.endsWith('dashboard')} className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
              {link.label}
            </NavLink>
          ))}
        </div>
        <div className="app-nav-user">
          <span className="text-sm text-muted truncate" title={user.email}>{name}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}><LogOut size={14} /> Logout</button>
        </div>
      </div>
    </nav>
  );
}
