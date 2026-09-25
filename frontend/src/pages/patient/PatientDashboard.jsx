import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Search, User, AlertCircle, Stethoscope } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { dashboardService } from '../../services/dashboard.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { formatDate, formatDoctorName } from '../../utils/date.js';

export default function PatientDashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const dashboard = await dashboardService.getPatientDashboard();
        if (active) setData(dashboard);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Unable to load your dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const patientName = data?.patient ? `${data.patient.firstName} ${data.patient.lastName}` : user?.firstName || 'Patient';

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>Patient Dashboard</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Welcome, {patientName}.</p>
          </div>
          <button className="btn btn-secondary" onClick={logout}>Logout</button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}><AlertCircle size={16} /> {error}</div>}

        <div className="grid-3">
          <Link className="card" to="/patient/doctors">
            <Search size={28} style={{ color: 'var(--color-primary-600)', marginBottom: 'var(--space-4)' }} />
            <h2 className="card-title">Find Doctors</h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>Browse specialists and check real availability.</p>
          </Link>
          <Link className="card" to="/patient/appointments">
            <Calendar size={28} style={{ color: 'var(--color-accent-600)', marginBottom: 'var(--space-4)' }} />
            <h2 className="card-title">My Appointments</h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>View and cancel eligible appointments.</p>
          </Link>
          <Link className="card" to="/patient/profile">
            <User size={28} style={{ color: 'var(--color-success-600)', marginBottom: 'var(--space-4)' }} />
            <h2 className="card-title">My Profile</h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>Review your account details.</p>
          </Link>
        </div>

        {loading ? (
          <div className="loading-wrapper"><div className="spinner" /></div>
        ) : !data ? (
          <div className="alert alert-info">Unable to load dashboard data.</div>
        ) : (
          <>
            <div className="grid-3" style={{ marginTop: 'var(--space-6)' }}>
              <div className="card">
                <h3 className="card-title">Upcoming</h3>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.stats?.upcomingCount ?? 0}</p>
              </div>
              <div className="card">
                <h3 className="card-title">Recent</h3>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.stats?.recentCount ?? 0}</p>
              </div>
              <div className="card">
                <h3 className="card-title">Total</h3>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.stats?.totalAppointments ?? 0}</p>
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 'var(--space-6)' }}>
              <div className="card">
                <h2 className="card-title">Upcoming appointments</h2>
                {data.upcoming?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {data.upcoming.map((appointment) => (
                      <div key={appointment.id} style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                          <strong>{formatDate(appointment.appointmentDate)}</strong>
                          <StatusBadge status={appointment.status} />
                        </div>
                        <div>{appointment.startTime} - {appointment.endTime}</div>
                        <div style={{ marginTop: 'var(--space-2)' }}><Stethoscope size={14} style={{ display: 'inline', marginRight: 6 }} /> {formatDoctorName(appointment.doctor)}</div>
                        <div style={{ color: 'var(--color-text-secondary)' }}>{appointment.doctor?.department?.name}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="alert alert-info">No upcoming appointments.</div>
                )}
              </div>

              <div className="card">
                <h2 className="card-title">Recent appointments</h2>
                {data.recent?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {data.recent.map((appointment) => (
                      <div key={appointment.id} style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                          <strong>{formatDate(appointment.appointmentDate)}</strong>
                          <StatusBadge status={appointment.status} />
                        </div>
                        <div>{appointment.startTime} - {appointment.endTime}</div>
                        <div style={{ marginTop: 'var(--space-2)' }}>{formatDoctorName(appointment.doctor)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="alert alert-info">No recent appointment history.</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
