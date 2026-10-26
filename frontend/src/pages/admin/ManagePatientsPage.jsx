import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { adminService } from '../../services/admin.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { apiErrorMessage, apiFieldErrors } from '../../utils/apiError.js';
import { formatDate, formatMoney, formatPersonName } from '../../utils/date.js';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
const EDITABLE = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'phone', 'address', 'bloodGroup'];

export default function ManagePatientsPage() {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const load = useCallback(async (term) => {
    try {
      setPatients(await adminService.listPatients(term ? { search: term } : {}));
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to load patients.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search), 250);
    return () => clearTimeout(timer);
  }, [search, load]);

  async function openPatient(id) {
    setError('');
    setMessage('');
    setFieldErrors({});
    try {
      const p = await adminService.getPatient(id);
      setSelected(p);
      setForm(Object.fromEntries(EDITABLE.map((k) => [k, p[k] ?? ''])));
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to load patient.'));
    }
  }

  async function run(action, success, { refreshSelected = true } = {}) {
    if (busy) return false;
    setBusy(true);
    setError('');
    setMessage('');
    setFieldErrors({});
    try {
      await action();
      setMessage(success);
      await load(search);
      if (refreshSelected && selected) await openPatient(selected.id);
      setMessage(success);
      return true;
    } catch (err) {
      setFieldErrors(apiFieldErrors(err));
      setError(apiErrorMessage(err, 'The request failed.'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function handleSave(e) {
    e.preventDefault();
    run(() => adminService.updatePatient(selected.id, form), 'Patient details saved.');
  }

  async function handleDelete(p) {
    if (confirmDeleteId !== p.id) {
      setConfirmDeleteId(p.id);
      return;
    }
    setConfirmDeleteId(null);
    const ok = await run(() => adminService.deletePatient(p.id), `Deleted ${formatPersonName(p)}.`, { refreshSelected: false });
    if (ok && selected?.id === p.id) setSelected(null);
  }

  const toggleActive = (p) =>
    run(() => adminService.updatePatient(p.id, { isActive: !p.isActive }), p.isActive ? 'Account deactivated — the patient can no longer log in.' : 'Account activated.');

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>Patients</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Patients with appointment history cannot be deleted — deactivate the account instead.</p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-6)', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 'calc(var(--space-6) + var(--space-4))', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input className="form-input" style={{ paddingLeft: 'calc(var(--space-4) + 16px + var(--space-2))' }} placeholder="Search by name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}><AlertCircle size={16} /> {error}</div>}
        {message && <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>{message}</div>}

        {selected && form && (
          <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="card-header">
              <div>
                <h2 className="card-title">{formatPersonName(selected)}</h2>
                <p className="text-sm text-muted">{selected.email} · {selected.isActive ? 'Active account' : 'Deactivated account'}</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-grid">
                {[['firstName', 'First name'], ['lastName', 'Last name'], ['phone', 'Phone']].map(([key, label]) => (
                  <div className="form-group" key={key}>
                    <label className="form-label" htmlFor={`pt-${key}`}>{label}</label>
                    <input id={`pt-${key}`} className={`form-input ${fieldErrors[key] ? 'error' : ''}`} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                    {fieldErrors[key] && <span className="form-error">{fieldErrors[key]}</span>}
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label" htmlFor="pt-dob">Date of birth</label>
                  <input id="pt-dob" type="date" className="form-input" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pt-gender">Gender</label>
                  <select id="pt-gender" className="form-select" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                    <option value="">Not specified</option>
                    {GENDERS.map((g) => <option key={g} value={g}>{g.replaceAll('_', ' ').toLowerCase()}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pt-blood">Blood group</label>
                  <select id="pt-blood" className="form-select" value={form.bloodGroup} onChange={(e) => setForm((f) => ({ ...f, bloodGroup: e.target.value }))}>
                    <option value="">Not specified</option>
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                <label className="form-label" htmlFor="pt-address">Address</label>
                <input id="pt-address" className="form-input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} maxLength={500} />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save details'}</button>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => toggleActive(selected)}>{selected.isActive ? 'Deactivate account' : 'Activate account'}</button>
              </div>
            </form>

            <h3 style={{ fontSize: 'var(--text-lg)', margin: 'var(--space-6) 0 var(--space-3)' }}>Appointments and bills</h3>
            {selected.appointments.length === 0 ? (
              <p className="text-sm text-muted">No appointments.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Date</th><th>Time</th><th>Doctor</th><th>Status</th><th>Bill</th></tr></thead>
                  <tbody>
                    {selected.appointments.map((a) => (
                      <tr key={a.id}>
                        <td>{formatDate(a.appointmentDate)}</td>
                        <td>{a.startTime} - {a.endTime}</td>
                        <td>Dr. {a.doctor.firstName} {a.doctor.lastName}{a.doctor.department ? ` · ${a.doctor.department}` : ''}</td>
                        <td><StatusBadge status={a.status} /></td>
                        <td>{a.bill ? <>{formatMoney(a.bill.amount)} <StatusBadge status={a.bill.paymentStatus} /></> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
        {!loading && patients.length === 0 && <div className="alert alert-info">No patients found.</div>}
        {!loading && patients.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Patient</th><th>Email</th><th>Phone</th><th>Blood group</th><th>Visits</th><th>Account</th><th>Actions</th></tr></thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id} style={p.isActive ? undefined : { opacity: 0.6 }}>
                    <td><strong>{formatPersonName(p)}</strong></td>
                    <td>{p.email}</td>
                    <td>{p.phone || '—'}</td>
                    <td>{p.bloodGroup || '—'}</td>
                    <td>{p.appointmentCount}</td>
                    <td><span className={`badge ${p.isActive ? 'badge-completed' : 'badge-cancelled'}`}>{p.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => openPatient(p.id)}>View / edit</button>
                        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => toggleActive(p)}>{p.isActive ? 'Deactivate' : 'Activate'}</button>
                        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => handleDelete(p)} onBlur={() => setConfirmDeleteId(null)}>
                          {confirmDeleteId === p.id ? 'Confirm delete' : 'Delete'}
                        </button>
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
