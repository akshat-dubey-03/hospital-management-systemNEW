import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appointmentsService } from '../../services/appointments.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { canCancelAppointment, formatDate, formatDoctorName } from '../../utils/date.js';

export default function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadAppointments() {
    setLoading(true);
    setError('');
    try {
      setAppointments(await appointmentsService.list());
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load appointments.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  async function cancelAppointment(id) {
    setError('');
    setMessage('');
    try {
      await appointmentsService.cancel(id, 'Cancelled by patient from portal.');
      setMessage('Appointment cancelled.');
      await loadAppointments();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to cancel appointment.');
    }
  }

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <h1>My Appointments</h1>
          <Link to="/patient/doctors" className="btn btn-primary">Book New</Link>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
        {message && <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>{message}</div>}
        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
        {!loading && appointments.length === 0 && <div className="alert alert-info">No appointments yet.</div>}
        {!loading && appointments.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Date</th><th>Time</th><th>Doctor</th><th>Department</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>{formatDate(appointment.appointmentDate)}</td>
                    <td>{appointment.startTime} - {appointment.endTime}</td>
                    <td>{formatDoctorName(appointment.doctor)}</td>
                    <td>{appointment.doctor?.department?.name}</td>
                    <td><StatusBadge status={appointment.status} /></td>
                    <td>
                      <button className="btn btn-danger btn-sm" disabled={!canCancelAppointment(appointment)} onClick={() => cancelAppointment(appointment.id)}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
