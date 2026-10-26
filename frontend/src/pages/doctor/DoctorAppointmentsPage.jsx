import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { appointmentsService } from '../../services/appointments.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { canCancelAppointment, formatDate } from '../../utils/date.js';
import { apiErrorMessage } from '../../utils/apiError.js';

const FILTERS = {
  ACTIVE: (a) => ['BOOKED', 'CONFIRMED'].includes(a.status),
  COMPLETED: (a) => a.status === 'COMPLETED',
  CANCELLED: (a) => a.status.startsWith('CANCELLED'),
  ALL: () => true,
};

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('ACTIVE');

  async function loadAppointments() {
    setLoading(true);
    try {
      setAppointments(await appointmentsService.list());
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to load appointments.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  async function updateStatus(id, status) {
    if (busyId) return;
    setBusyId(id);
    setError('');
    setMessage('');
    try {
      if (status === 'CANCELLED_BY_DOCTOR') {
        await appointmentsService.cancel(id, 'Cancelled by doctor from portal.');
        setMessage('Appointment cancelled.');
      } else {
        const result = await appointmentsService.updateStatus(id, { status });
        setMessage(result.message || 'Appointment updated.');
      }
      await loadAppointments();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to update appointment.'));
    } finally {
      setBusyId(null);
    }
  }

  const visible = useMemo(() => appointments.filter(FILTERS[filter]), [appointments, filter]);

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <h1>My Appointments</h1>
          <select className="form-select" style={{ maxWidth: 200 }} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
            <option value="ACTIVE">Booked &amp; confirmed</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="ALL">All</option>
          </select>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
        {message && <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>{message}</div>}
        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
        {!loading && visible.length === 0 && <div className="alert alert-info">No appointments in this view.</div>}
        {!loading && visible.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Date</th><th>Time</th><th>Patient</th><th>Reason</th><th>Status</th><th>Record</th><th>Actions</th></tr></thead>
              <tbody>
                {visible.map((appointment) => {
                  const busy = busyId === appointment.id;
                  return (
                    <tr key={appointment.id}>
                      <td>{formatDate(appointment.appointmentDate)}</td>
                      <td>{appointment.startTime} - {appointment.endTime}</td>
                      <td>{appointment.patient?.firstName} {appointment.patient?.lastName}</td>
                      <td>{appointment.reasonForVisit || 'Not provided'}</td>
                      <td><StatusBadge status={appointment.status} /></td>
                      <td>{appointment.medicalRecordId ? 'Written' : ['CONFIRMED', 'COMPLETED'].includes(appointment.status) ? <span className="text-muted">Pending</span> : '—'}</td>
                      <td>
                        <div className="row-actions">
                          <Link className="btn btn-primary btn-sm" to={`/doctor/appointments/${appointment.id}`}>Open</Link>
                          <button className="btn btn-secondary btn-sm" disabled={busy || appointment.status !== 'BOOKED'} onClick={() => updateStatus(appointment.id, 'CONFIRMED')}>Confirm</button>
                          <button className="btn btn-secondary btn-sm" disabled={busy || appointment.status !== 'CONFIRMED'} onClick={() => updateStatus(appointment.id, 'COMPLETED')}>Complete</button>
                          <button className="btn btn-danger btn-sm" disabled={busy || !canCancelAppointment(appointment)} onClick={() => updateStatus(appointment.id, 'CANCELLED_BY_DOCTOR')}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
