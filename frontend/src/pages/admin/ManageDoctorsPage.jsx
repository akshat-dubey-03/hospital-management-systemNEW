import { useEffect, useState } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { adminService } from '../../services/admin.service.js';
import { departmentsService } from '../../services/departments.service.js';
import { apiErrorMessage, apiFieldErrors } from '../../utils/apiError.js';
import { DAY_NAMES, formatMoney } from '../../utils/date.js';

const EMPTY_FORM = {
  email: '', password: '', departmentId: '', firstName: '', lastName: '', specialization: '', qualification: '',
  experienceYears: '', consultationFee: '', slotDurationMinutes: '30', phone: '', bio: '',
};
const EMPTY_BLOCK = { dayOfWeek: '0', startTime: '09:00', endTime: '13:00' };

function toForm(d) {
  return {
    ...EMPTY_FORM,
    departmentId: d.department?.id ?? '',
    firstName: d.firstName, lastName: d.lastName, specialization: d.specialization, qualification: d.qualification,
    experienceYears: d.experienceYears ?? '', consultationFee: d.consultationFee ?? '', slotDurationMinutes: String(d.slotDurationMinutes),
    phone: d.phone ?? '', bio: d.bio ?? '',
  };
}

function toPayload(form, isCreate) {
  const payload = {
    departmentId: form.departmentId,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    specialization: form.specialization.trim(),
    qualification: form.qualification.trim(),
    experienceYears: form.experienceYears === '' ? null : Number(form.experienceYears),
    consultationFee: form.consultationFee === '' ? null : Number(form.consultationFee),
    slotDurationMinutes: Number(form.slotDurationMinutes),
    phone: form.phone.trim() || null,
    bio: form.bio.trim() || null,
  };
  if (isCreate) {
    payload.email = form.email.trim();
    payload.password = form.password;
  }
  return payload;
}

const toBlocks = (rows) => rows.map((b) => ({ dayOfWeek: Number(b.dayOfWeek), startTime: b.startTime, endTime: b.endTime }));

function AvailabilityEditor({ rows, onChange }) {
  const update = (i, key, value) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {rows.length === 0 && <p className="text-sm text-muted">No weekly hours — patients will not see any slots.</p>}
      {rows.map((row, i) => (
        <div key={i} className="row-actions" style={{ alignItems: 'center' }}>
          <select className="form-select" style={{ width: 110 }} value={row.dayOfWeek} onChange={(e) => update(i, 'dayOfWeek', e.target.value)} aria-label="Day">
            {DAY_NAMES.map((d, idx) => <option key={d} value={idx}>{d}</option>)}
          </select>
          <input type="time" className="form-input" style={{ width: 130 }} value={row.startTime} onChange={(e) => update(i, 'startTime', e.target.value)} aria-label="Start" required />
          <span>to</span>
          <input type="time" className="form-input" style={{ width: 130 }} value={row.endTime} onChange={(e) => update(i, 'endTime', e.target.value)} aria-label="End" required />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} aria-label="Remove block"><Trash2 size={14} /></button>
        </div>
      ))}
      <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...rows, { ...EMPTY_BLOCK }])}><Plus size={14} /> Add hours</button></div>
    </div>
  );
}

export default function ManageDoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const [mode, setMode] = useState(null); // null | 'create' | 'edit' | 'schedule'
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [blocks, setBlocks] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  async function load() {
    try {
      const [docs, depts] = await Promise.all([adminService.listDoctors(), departmentsService.list()]);
      setDoctors(docs);
      setDepartments(depts);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to load doctors.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function open(nextMode, doctor = null) {
    setMode(nextMode);
    setCurrent(doctor);
    setFieldErrors({});
    setError('');
    setMessage('');
    setForm(doctor ? toForm(doctor) : { ...EMPTY_FORM, departmentId: departments[0]?.id ?? '' });
    setBlocks(doctor ? doctor.availability.map((b) => ({ dayOfWeek: String(b.dayOfWeek), startTime: b.startTime, endTime: b.endTime })) : [{ ...EMPTY_BLOCK }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function run(action, success) {
    if (busy) return false;
    setBusy(true);
    setError('');
    setMessage('');
    setFieldErrors({});
    try {
      await action();
      setMessage(success);
      await load();
      return true;
    } catch (err) {
      setFieldErrors(apiFieldErrors(err));
      setError(apiErrorMessage(err, 'The request failed.'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    let ok = false;
    if (mode === 'create') {
      ok = await run(() => adminService.createDoctor({ ...toPayload(form, true), availability: toBlocks(blocks) }), 'Doctor account created. They can now log in on the doctor login page.');
    } else if (mode === 'edit') {
      ok = await run(() => adminService.updateDoctor(current.id, toPayload(form, false)), 'Doctor updated.');
    } else if (mode === 'schedule') {
      ok = await run(() => adminService.replaceAvailability(current.id, toBlocks(blocks)), 'Weekly hours updated.');
    }
    if (ok) setMode(null);
  }

  async function handleDelete(d) {
    if (confirmDeleteId !== d.id) {
      setConfirmDeleteId(d.id);
      return;
    }
    setConfirmDeleteId(null);
    await run(() => adminService.deleteDoctor(d.id), `Deleted Dr. ${d.firstName} ${d.lastName}.`);
  }

  const field = (key, label, props = {}) => (
    <div className="form-group">
      <label className={`form-label ${props.required ? 'required' : ''}`} htmlFor={`doc-${key}`}>{label}</label>
      <input id={`doc-${key}`} className={`form-input ${fieldErrors[key] ? 'error' : ''}`} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} {...props} />
      {fieldErrors[key] && <span className="form-error">{fieldErrors[key]}</span>}
    </div>
  );

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>Doctors</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Doctors with appointment history cannot be deleted — deactivate them instead.</p>
          </div>
          {!mode && <button className="btn btn-primary" onClick={() => open('create')} disabled={!departments.length}><Plus size={16} /> Add doctor</button>}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}><AlertCircle size={16} /> {error}</div>}
        {message && <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>{message}</div>}

        {mode && (
          <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 'var(--space-6)' }}>
            <h2 className="card-title">
              {mode === 'create' ? 'New doctor account' : mode === 'edit' ? `Edit Dr. ${current.firstName} ${current.lastName}` : `Weekly hours — Dr. ${current.firstName} ${current.lastName}`}
            </h2>
            {mode !== 'schedule' && (
              <div className="form-grid">
                {mode === 'create' && field('email', 'Login email', { type: 'email', required: true })}
                {mode === 'create' && field('password', 'Initial password', { type: 'password', required: true, minLength: 8, placeholder: 'Upper, lower and a number' })}
                <div className="form-group">
                  <label className="form-label required" htmlFor="doc-departmentId">Department</label>
                  <select id="doc-departmentId" className="form-select" value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))} required>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                {field('firstName', 'First name', { required: true, minLength: 2, maxLength: 100 })}
                {field('lastName', 'Last name', { required: true, minLength: 2, maxLength: 100 })}
                {field('specialization', 'Specialization', { required: true, maxLength: 200 })}
                {field('qualification', 'Qualification', { required: true, maxLength: 200 })}
                {field('experienceYears', 'Experience (years)', { type: 'number', min: 0, max: 80 })}
                {field('consultationFee', 'Consultation fee (₹)', { type: 'number', min: 0, step: '0.01' })}
                {field('slotDurationMinutes', 'Slot length (minutes)', { type: 'number', min: 5, max: 240, required: true })}
                {field('phone', 'Phone')}
              </div>
            )}
            {mode !== 'schedule' && (
              <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                <label className="form-label" htmlFor="doc-bio">Bio</label>
                <textarea id="doc-bio" className="form-textarea" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} maxLength={2000} />
              </div>
            )}
            {(mode === 'create' || mode === 'schedule') && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <label className="form-label">Weekly hours</label>
                <AvailabilityEditor rows={blocks} onChange={setBlocks} />
              </div>
            )}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : mode === 'create' ? 'Create doctor' : 'Save'}</button>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setMode(null)}>Cancel</button>
            </div>
          </form>
        )}

        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
        {!loading && doctors.length === 0 && <div className="alert alert-info">No doctors yet.</div>}
        {!loading && doctors.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Doctor</th><th>Department</th><th>Fee</th><th>Weekly hours</th><th>Visits</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {doctors.map((d) => (
                  <tr key={d.id} style={d.isActive ? undefined : { opacity: 0.6 }}>
                    <td><strong>Dr. {d.firstName} {d.lastName}</strong><div className="text-xs text-muted">{d.specialization}</div><div className="text-xs text-muted">{d.email}</div></td>
                    <td>{d.department?.name}</td>
                    <td>{d.consultationFee != null ? formatMoney(d.consultationFee) : <span className="text-muted">Not set</span>}</td>
                    <td className="text-xs">{d.availability.length ? d.availability.map((b) => `${DAY_NAMES[b.dayOfWeek]} ${b.startTime}–${b.endTime}`).join(', ') : <span className="text-muted">None</span>}</td>
                    <td>{d.appointmentCount}</td>
                    <td><span className={`badge ${d.isActive ? 'badge-completed' : 'badge-cancelled'}`}>{d.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => open('edit', d)}>Edit</button>
                        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => open('schedule', d)}>Hours</button>
                        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run(() => adminService.updateDoctor(d.id, { isActive: !d.isActive }), d.isActive ? 'Doctor deactivated (login blocked, hidden from patients).' : 'Doctor activated.')}>
                          {d.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => handleDelete(d)} onBlur={() => setConfirmDeleteId(null)}>
                          {confirmDeleteId === d.id ? 'Confirm delete' : 'Delete'}
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
