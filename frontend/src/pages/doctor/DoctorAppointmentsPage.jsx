import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appointmentsService } from '../../services/appointments.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { canCancelAppointment, formatDate } from '../../utils/date.js';

export default function DoctorAppointmentsPage() {
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

  async function updateStatus(id, status) {
    setError('');
    setMessage('');
    try {
      if (status === 'CANCELLED_BY_DOCTOR') {
        await appointmentsService.cancel(id, 'Cancelled by doctor from portal.');
      } else {
        await appointmentsService.updateStatus(id, { status });
      }
      setMessage('Appointment updated.');
      await loadAppointments();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update appointment.');
    }
  }

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <h1>My Appointments</h1>
          <Link to="/doctor/dashboard" className="btn btn-secondary">Dashboard</Link>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
        {message && <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>{message}</div>}
        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
        {!loading && appointments.length === 0 && <div className="alert alert-info">No appointments assigned to you.</div>}
        {!loading && appointments.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Date</th><th>Time</th><th>Patient</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>{formatDate(appointment.appointmentDate)}</td>
                    <td>{appointment.startTime} - {appointment.endTime}</td>
                    <td>{appointment.patient?.firstName} {appointment.patient?.lastName}</td>
                    <td>{appointment.reasonForVisit || 'Not provided'}</td>
                    <td><StatusBadge status={appointment.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" disabled={appointment.status !== 'BOOKED'} onClick={() => updateStatus(appointment.id, 'CONFIRMED')}>Confirm</button>
                        <button className="btn btn-secondary btn-sm" disabled={appointment.status !== 'CONFIRMED'} onClick={() => updateStatus(appointment.id, 'COMPLETED')}>Complete</button>
                        <button className="btn btn-danger btn-sm" disabled={!canCancelAppointment(appointment)} onClick={() => updateStatus(appointment.id, 'CANCELLED_BY_DOCTOR')}>Cancel</button>
                      </div>
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
