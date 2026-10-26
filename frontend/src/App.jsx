// src/App.jsx
// Root application component.
// Sets up React Router with role-based protected routes.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { setApiAccessToken } from './services/api.js';
import { useEffect } from 'react';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';

// Public pages
import LandingPage    from './pages/public/LandingPage.jsx';
import LoginPage      from './pages/public/LoginPage.jsx';
import RegisterPage   from './pages/public/RegisterPage.jsx';
import DoctorLoginPage from './pages/public/DoctorLoginPage.jsx';
import AdminLoginPage  from './pages/public/AdminLoginPage.jsx';

// Patient pages
import PatientDashboard     from './pages/patient/PatientDashboard.jsx';
import DoctorListPage       from './pages/patient/DoctorListPage.jsx';
import DoctorProfilePage    from './pages/patient/DoctorProfilePage.jsx';
import BookAppointmentPage  from './pages/patient/BookAppointmentPage.jsx';
import MyAppointmentsPage   from './pages/patient/MyAppointmentsPage.jsx';
import PatientProfilePage   from './pages/patient/PatientProfilePage.jsx';
import FeedbackPage         from './pages/patient/FeedbackPage.jsx';
import PatientRecordsPage   from './pages/patient/PatientRecordsPage.jsx';
import PatientBillsPage     from './pages/patient/PatientBillsPage.jsx';

// Doctor pages
import DoctorDashboard         from './pages/doctor/DoctorDashboard.jsx';
import DoctorAppointmentsPage  from './pages/doctor/DoctorAppointmentsPage.jsx';
import DoctorPatientSearchPage from './pages/doctor/PatientSearchPage.jsx';
import DoctorAppointmentDetailPage from './pages/doctor/DoctorAppointmentDetailPage.jsx';

// Admin pages
import AdminDashboard         from './pages/admin/AdminDashboard.jsx';
import ManageDoctorsPage      from './pages/admin/ManageDoctorsPage.jsx';
import ManagePatientsPage     from './pages/admin/ManagePatientsPage.jsx';
import ManageDepartmentsPage  from './pages/admin/ManageDepartmentsPage.jsx';
import ManageAppointmentsPage from './pages/admin/ManageAppointmentsPage.jsx';
import FeedbackQueriesPage    from './pages/admin/FeedbackQueriesPage.jsx';
import ManageBillsPage        from './pages/admin/ManageBillsPage.jsx';

function TokenSync() {
  const { accessToken } = useAuth();
  useEffect(() => {
    setApiAccessToken(accessToken);
  }, [accessToken]);
  return null;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"             element={<LandingPage />} />
      <Route path="/login"        element={<LoginPage />} />
      <Route path="/register"     element={<RegisterPage />} />
      <Route path="/doctor/login" element={<DoctorLoginPage />} />
      <Route path="/admin/login"  element={<AdminLoginPage />} />

      {/* Patient */}
      <Route path="/patient/dashboard"        element={<ProtectedRoute role="PATIENT"><PatientDashboard /></ProtectedRoute>} />
      <Route path="/patient/doctors"          element={<ProtectedRoute role="PATIENT"><DoctorListPage /></ProtectedRoute>} />
      <Route path="/patient/doctors/:id"      element={<ProtectedRoute role="PATIENT"><DoctorProfilePage /></ProtectedRoute>} />
      <Route path="/patient/doctors/:id/book" element={<ProtectedRoute role="PATIENT"><BookAppointmentPage /></ProtectedRoute>} />
      <Route path="/patient/appointments"     element={<ProtectedRoute role="PATIENT"><MyAppointmentsPage /></ProtectedRoute>} />
      <Route path="/patient/profile"          element={<ProtectedRoute role="PATIENT"><PatientProfilePage /></ProtectedRoute>} />
      <Route path="/patient/records"          element={<ProtectedRoute role="PATIENT"><PatientRecordsPage /></ProtectedRoute>} />
      <Route path="/patient/bills"            element={<ProtectedRoute role="PATIENT"><PatientBillsPage /></ProtectedRoute>} />
      <Route path="/patient/feedback"         element={<ProtectedRoute role="PATIENT"><FeedbackPage /></ProtectedRoute>} />

      {/* Doctor */}
      <Route path="/doctor/dashboard"    element={<ProtectedRoute role="DOCTOR"><DoctorDashboard /></ProtectedRoute>} />
      <Route path="/doctor/appointments" element={<ProtectedRoute role="DOCTOR"><DoctorAppointmentsPage /></ProtectedRoute>} />
      <Route path="/doctor/appointments/:id" element={<ProtectedRoute role="DOCTOR"><DoctorAppointmentDetailPage /></ProtectedRoute>} />
      <Route path="/doctor/patients"     element={<ProtectedRoute role="DOCTOR"><DoctorPatientSearchPage /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin/dashboard"    element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/doctors"      element={<ProtectedRoute role="ADMIN"><ManageDoctorsPage /></ProtectedRoute>} />
      <Route path="/admin/patients"     element={<ProtectedRoute role="ADMIN"><ManagePatientsPage /></ProtectedRoute>} />
      <Route path="/admin/departments"  element={<ProtectedRoute role="ADMIN"><ManageDepartmentsPage /></ProtectedRoute>} />
      <Route path="/admin/appointments" element={<ProtectedRoute role="ADMIN"><ManageAppointmentsPage /></ProtectedRoute>} />
      <Route path="/admin/bills"        element={<ProtectedRoute role="ADMIN"><ManageBillsPage /></ProtectedRoute>} />
      <Route path="/admin/feedback"     element={<ProtectedRoute role="ADMIN"><FeedbackQueriesPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TokenSync />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
