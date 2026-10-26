import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, AlertCircle, Stethoscope } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { dashboardService } from '../../services/dashboard.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { formatDate } from '../../utils/date.js';

export default function DoctorDashboard() {
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
        const dashboard = await dashboardService.getDoctorDashboard();
        if (active) setData(dashboard);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Unable to load doctor dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const doctorName = data?.doctor ? `${data.doctor.firstName} ${data.doctor.lastName}` : user?.firstName || 'Doctor';

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>Doctor Dashboard</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Welcome, Dr. {doctorName}.</p>
          </div>
          <button className="btn btn-secondary" onClick={logout}>Logout</button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}><AlertCircle size={16} /> {error}</div>}

        <div className="grid-3">
          <Link className="card" to="/doctor/appointments">
            <Calendar size={28} style={{ color: 'var(--color-primary-600)', marginBottom: 'var(--space-4)' }} />
            <h2 className="card-title">Appointments</h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>View, confirm, complete, or cancel your appointments.</p>
          </Link>
          <Link className="card" to="/doctor/patients">
            <Users size={28} style={{ color: 'var(--color-accent-600)', marginBottom: 'var(--space-4)' }} />
            <h2 className="card-title">Patients</h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>Review patient access and appointment history.</p>
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
                <h3 className="card-title">Today</h3>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.stats?.todayCount ?? 0}</p>
              </div>
              <div className="card">
                <h3 className="card-title">Upcoming</h3>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.stats?.upcomingCount ?? 0}</p>
              </div>
              <div className="card">
                <h3 className="card-title">Confirmed</h3>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.stats?.confirmedCount ?? 0}</p>
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 'var(--space-6)' }}>
              <div className="card">
                <h2 className="card-title">Today&apos;s appointments</h2>
                {data.todaysAppointments?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {data.todaysAppointments.map((appointment) => (
                      <div key={appointment.id} style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                          <strong>{appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Patient'}</strong>
                          <StatusBadge status={appointment.status} />
                        </div>
                        <div>{appointment.startTime} - {appointment.endTime}</div>
                        <div style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>{formatDate(appointment.appointmentDate)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="alert alert-info">No appointments scheduled for today.</div>
                )}
              </div>

              <div className="card">
                <h2 className="card-title">Upcoming schedule</h2>
                {data.upcomingAppointments?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {data.upcomingAppointments.map((appointment) => (
                      <div key={appointment.id} style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                          <strong>{appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Patient'}</strong>
                          <StatusBadge status={appointment.status} />
                        </div>
                        <div>{formatDate(appointment.appointmentDate)} • {appointment.startTime} - {appointment.endTime}</div>
                        <div style={{ marginTop: 'var(--space-2)' }}><Stethoscope size={14} style={{ display: 'inline', marginRight: 6 }} /> {data.doctor?.department?.name}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="alert alert-info">No future appointments scheduled.</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
