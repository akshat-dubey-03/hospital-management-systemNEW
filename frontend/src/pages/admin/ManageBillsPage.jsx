import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { billsService } from '../../services/bills.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { apiErrorMessage } from '../../utils/apiError.js';
import { formatDate, formatMoney, formatPersonName } from '../../utils/date.js';

// Billing records for demonstration — statuses are recorded manually, there is
// no payment gateway.
export default function ManageBillsPage() {
  const [bills, setBills] = useState([]);
  const [unbilled, setUnbilled] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [amounts, setAmounts] = useState({}); // appointmentId|billId -> input value
  const [editingId, setEditingId] = useState(null);

  async function load(currentStatus = status) {
    try {
      const [b, u] = await Promise.all([billsService.list(currentStatus ? { status: currentStatus } : {}), billsService.unbilled()]);
      setBills(b);
      setUnbilled(u);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to load bills.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load(status);
  }, [status]);

  async function run(id, action, success) {
    if (busyId) return;
    setBusyId(id);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'The request failed.'));
    } finally {
      setBusyId(null);
    }
  }

  function createBill(a) {
    const raw = amounts[a.id] ?? (a.suggestedAmount ?? '');
    const payload = { appointmentId: a.id };
    if (raw !== '') payload.amount = Number(raw);
    run(a.id, () => billsService.create(payload), `Bill created for ${formatPersonName(a.patient)}.`);
  }

  const totals = useMemo(() => {
    const sum = (s) => bills.filter((b) => b.paymentStatus === s).reduce((acc, b) => acc + Number(b.amount), 0);
    return { pending: sum('PENDING'), paid: sum('PAID') };
  }, [bills]);

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>Bills</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Billing records only — payments are marked here manually; no payment gateway.</p>
          </div>
          <div className="row-actions">
            <div className="stat-card"><div><p className="stat-label">Pending (shown)</p><p className="stat-value">{formatMoney(totals.pending)}</p></div></div>
            <div className="stat-card"><div><p className="stat-label">Paid (shown)</p><p className="stat-value">{formatMoney(totals.paid)}</p></div></div>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}><AlertCircle size={16} /> {error}</div>}
        {message && <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>{message}</div>}

        {unbilled.length > 0 && (
          <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <h2 className="card-title">Completed visits without a bill</h2>
            <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-3)' }}>
              These were completed while the doctor had no consultation fee (or before billing existed). Enter the amount and create the bill.
            </p>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Visit</th><th>Patient</th><th>Doctor</th><th>Amount (₹)</th><th /></tr></thead>
                <tbody>
                  {unbilled.map((a) => (
                    <tr key={a.id}>
                      <td>{formatDate(a.appointmentDate)} {a.startTime}</td>
                      <td>{formatPersonName(a.patient)}</td>
                      <td>Dr. {formatPersonName(a.doctor)}</td>
                      <td>
                        <input
                          type="number" min="0" step="0.01" className="form-input" style={{ width: 140 }} aria-label="Amount"
                          placeholder={a.suggestedAmount != null ? String(a.suggestedAmount) : 'Required'}
                          value={amounts[a.id] ?? (a.suggestedAmount ?? '')}
                          onChange={(e) => setAmounts((m) => ({ ...m, [a.id]: e.target.value }))}
                        />
                      </td>
                      <td><button className="btn btn-primary btn-sm" disabled={busyId === a.id} onClick={() => createBill(a)}>{busyId === a.id ? 'Creating...' : 'Create bill'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="toolbar">
          <div className="form-group">
            <label className="form-label" htmlFor="bill-status">Payment status</label>
            <select id="bill-status" className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
        {!loading && bills.length === 0 && <div className="alert alert-info">No bills{status ? ' with this status' : ''}.</div>}
        {!loading && bills.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Bill date</th><th>Patient</th><th>Doctor</th><th>Visit</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {bills.map((b) => {
                  const busy = busyId === b.id;
                  return (
                    <tr key={b.id}>
                      <td>{formatDate(b.billDate)}</td>
                      <td>{formatPersonName(b.appointment?.patient)}</td>
                      <td>Dr. {formatPersonName(b.appointment?.doctor)}<div className="text-xs text-muted">{b.appointment?.doctor?.department}</div></td>
                      <td>{b.appointment ? `${formatDate(b.appointment.appointmentDate)} ${b.appointment.startTime}` : '—'}</td>
                      <td>
                        {editingId === b.id ? (
                          <span className="row-actions">
                            <input type="number" min="0" step="0.01" className="form-input" style={{ width: 120 }} aria-label="New amount" value={amounts[b.id] ?? b.amount} onChange={(e) => setAmounts((m) => ({ ...m, [b.id]: e.target.value }))} />
                            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(b.id, () => billsService.update(b.id, { amount: Number(amounts[b.id] ?? b.amount) }), 'Amount updated.')}>Save</button>
                            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setEditingId(null)}>Cancel</button>
                          </span>
                        ) : (
                          <strong>{formatMoney(b.amount)}</strong>
                        )}
                      </td>
                      <td><StatusBadge status={b.paymentStatus} />{b.paidAt && <div className="text-xs text-muted">{formatDate(String(b.paidAt).slice(0, 10))}</div>}</td>
                      <td>
                        <div className="row-actions">
                          {b.paymentStatus === 'PENDING' && (
                            <>
                              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(b.id, () => billsService.update(b.id, { paymentStatus: 'PAID' }), 'Bill marked as paid.')}>Mark paid</button>
                              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setEditingId(b.id)}>Edit amount</button>
                              <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(b.id, () => billsService.update(b.id, { paymentStatus: 'CANCELLED' }), 'Bill cancelled.')}>Cancel bill</button>
                            </>
                          )}
                          {b.paymentStatus === 'PAID' && (
                            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run(b.id, () => billsService.update(b.id, { paymentStatus: 'PENDING' }), 'Payment reverted to pending.')}>Mark unpaid</button>
                          )}
                          {b.paymentStatus === 'CANCELLED' && <span className="text-xs text-muted">Final</span>}
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
