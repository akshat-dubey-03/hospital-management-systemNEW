import { useEffect, useState } from 'react';
import { AlertCircle, Calendar, UserRound, Users, XCircle } from 'lucide-react';
import { dashboardService } from '../../services/dashboard.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { formatDate } from '../../utils/date.js';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const stats = await dashboardService.getAdminStats();
        if (active) setData(stats);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Unable to load dashboard statistics.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>Admin Dashboard</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Operational overview</p>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}><AlertCircle size={16} /> {error}</div>}

        {loading ? (
          <div className="loading-wrapper"><div className="spinner" /></div>
        ) : !data ? (
          <div className="alert alert-info">No dashboard data available.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
              <div className="card">
                <UserRound size={20} style={{ color: 'var(--color-primary-600)', marginBottom: 'var(--space-2)' }} />
                <h3 className="card-title">Patients</h3>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.totals?.totalPatients ?? 0}</p>
              </div>
              <div className="card">
                <Users size={20} style={{ color: 'var(--color-accent-600)', marginBottom: 'var(--space-2)' }} />
                <h3 className="card-title">Doctors</h3>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.totals?.totalDoctors ?? 0}</p>
              </div>
              <div className="card">
                <Calendar size={20} style={{ color: 'var(--color-warning-600)', marginBottom: 'var(--space-2)' }} />
                <h3 className="card-title">Today</h3>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.totals?.todayAppointments ?? 0}</p>
              </div>
              <div className="card">
                <Calendar size={20} style={{ color: 'var(--color-primary-600)', marginBottom: 'var(--space-2)' }} />
                <h3 className="card-title">Pending</h3>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.totals?.pendingAppointments ?? 0}</p>
              </div>
              <div className="card">
                <XCircle size={20} style={{ color: 'var(--color-danger-600)', marginBottom: 'var(--space-2)' }} />
                <h3 className="card-title">Cancelled</h3>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.totals?.cancelledAppointments ?? 0}</p>
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 'var(--space-6)' }}>
              <div className="card">
                <h2 className="card-title">Recent appointments</h2>
                {data.recentAppointments?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {data.recentAppointments.map((appointment) => (
                      <div key={appointment.id} style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                          <strong>{appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Patient'}</strong>
                          <StatusBadge status={appointment.status} />
                        </div>
                        <div>{formatDate(appointment.appointmentDate)} • {appointment.startTime} - {appointment.endTime}</div>
                        <div style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                          {appointment.doctor ? `${appointment.doctor.firstName} ${appointment.doctor.lastName}` : 'Doctor'}
                          {appointment.doctor?.department ? ` • ${appointment.doctor.department.name}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="alert alert-info">No appointments recorded.</div>
                )}
              </div>

              <div className="card">
                <h2 className="card-title">Quick summary</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total appointments</span><strong>{data.totals?.totalAppointments ?? 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cancelled</span><strong>{data.totals?.cancelledAppointments ?? 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Pending</span><strong>{data.totals?.pendingAppointments ?? 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Today</span><strong>{data.totals?.todayAppointments ?? 0}</strong></div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

