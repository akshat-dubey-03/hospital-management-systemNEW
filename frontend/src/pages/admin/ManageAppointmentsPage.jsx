import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { appointmentsService } from '../../services/appointments.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { apiErrorMessage } from '../../utils/apiError.js';
import { canCancelAppointment, formatDate, formatMoney, formatPersonName } from '../../utils/date.js';

const GROUPS = {
  ALL: () => true,
  ACTIVE: (a) => ['BOOKED', 'CONFIRMED'].includes(a.status),
  COMPLETED: (a) => a.status === 'COMPLETED',
  CANCELLED: (a) => a.status.startsWith('CANCELLED'),
};

export default function ManageAppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [group, setGroup] = useState('ALL');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    try {
      setAppointments(await appointmentsService.list());
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to load appointments.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(appointment, action) {
    if (busyId) return;
    setBusyId(appointment.id);
    setError('');
    setMessage('');
    try {
      if (action === 'CANCEL') {
        await appointmentsService.cancel(appointment.id, 'Cancelled by administrator.');
        setMessage('Appointment cancelled.');
      } else {
        const result = await appointmentsService.updateStatus(appointment.id, { status: action });
        setMessage(result.message);
      }
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to update the appointment.'));
    } finally {
      setBusyId(null);
    }
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return appointments
      .filter(GROUPS[group])
      .filter((a) => !date || a.appointmentDate === date)
      .filter((a) => !term || `${formatPersonName(a.patient)} ${formatPersonName(a.doctor)} ${a.doctor?.department?.name ?? ''}`.toLowerCase().includes(term))
      .sort((a, b) => `${b.appointmentDate}${b.startTime}`.localeCompare(`${a.appointmentDate}${a.startTime}`));
  }, [appointments, group, date, search]);

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>Appointments</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Completing an appointment creates its bill from the doctor&apos;s consultation fee.</p>
          </div>
        </div>

        <div className="card toolbar">
          <div className="form-group">
            <label className="form-label" htmlFor="appt-group">Status</label>
            <select id="appt-group" className="form-select" value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="ALL">All</option>
              <option value="ACTIVE">Booked &amp; confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="appt-date">Date</label>
            <input id="appt-date" type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label" htmlFor="appt-search">Patient / doctor / department</label>
            <input id="appt-search" className="form-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" />
          </div>
          {(date || search || group !== 'ALL') && <button className="btn btn-secondary" onClick={() => { setDate(''); setSearch(''); setGroup('ALL'); }}>Clear</button>}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}><AlertCircle size={16} /> {error}</div>}
        {message && <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>{message}</div>}
        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
        {!loading && visible.length === 0 && <div className="alert alert-info">No appointments match these filters.</div>}

        {!loading && visible.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Date</th><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th><th>Bill</th><th>Actions</th></tr></thead>
              <tbody>
                {visible.map((a) => {
                  const busy = busyId === a.id;
                  return (
                    <tr key={a.id}>
                      <td>{formatDate(a.appointmentDate)}</td>
                      <td>{a.startTime} - {a.endTime}</td>
                      <td>{formatPersonName(a.patient)}{a.patient?.phone ? <div className="text-xs text-muted">{a.patient.phone}</div> : null}</td>
                      <td>Dr. {formatPersonName(a.doctor)}<div className="text-xs text-muted">{a.doctor?.department?.name}</div></td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        {a.bill ? (
                          <>{formatMoney(a.bill.amount)} <StatusBadge status={a.bill.paymentStatus} /></>
                        ) : a.status === 'COMPLETED' ? (
                          <Link to="/admin/bills" className="text-primary font-semibold">Needs bill</Link>
                        ) : '—'}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-secondary btn-sm" disabled={busy || a.status !== 'BOOKED'} onClick={() => act(a, 'CONFIRMED')}>Confirm</button>
                          <button className="btn btn-secondary btn-sm" disabled={busy || a.status !== 'CONFIRMED'} onClick={() => act(a, 'COMPLETED')}>Complete</button>
                          <button className="btn btn-danger btn-sm" disabled={busy || !canCancelAppointment(a)} onClick={() => act(a, 'CANCEL')}>Cancel</button>
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
