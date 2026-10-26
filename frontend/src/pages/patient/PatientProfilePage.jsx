import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { patientsService } from '../../services/patients.service.js';
import { apiErrorMessage, apiFieldErrors } from '../../utils/apiError.js';
import { formatDate } from '../../utils/date.js';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = [
  ['MALE', 'Male'],
  ['FEMALE', 'Female'],
  ['OTHER', 'Other'],
  ['PREFER_NOT_TO_SAY', 'Prefer not to say'],
];
const EDITABLE = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'phone', 'address', 'bloodGroup'];

function toForm(patient) {
  return Object.fromEntries(EDITABLE.map((key) => [key, patient?.[key] ?? '']));
}

export default function PatientProfilePage() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(toForm(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    patientsService
      .me()
      .then((data) => {
        if (!active) return;
        setProfile(data);
        setForm(toForm(data));
      })
      .catch((err) => active && setError(apiErrorMessage(err, 'Unable to load your profile.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    setFieldErrors({});
    try {
      const saved = await patientsService.updateMe(form);
      setProfile(saved);
      setForm(toForm(saved));
      setMessage('Profile saved.');
    } catch (err) {
      setFieldErrors(apiFieldErrors(err));
      setError(apiErrorMessage(err, 'Unable to save your profile.'));
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = (key) => `form-input ${fieldErrors[key] ? 'error' : ''}`;

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>My Profile</h1>
            {profile && <p style={{ color: 'var(--color-text-secondary)' }}>{profile.email} · member since {formatDate(String(profile.createdAt).slice(0, 10))}</p>}
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}><AlertCircle size={16} /> {error}</div>}
        {message && <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>{message}</div>}

        {loading ? (
          <div className="loading-wrapper"><div className="spinner" /></div>
        ) : profile ? (
          <form className="card" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="firstName">First name</label>
                <input id="firstName" className={fieldClass('firstName')} value={form.firstName} onChange={(e) => update('firstName', e.target.value)} required minLength={2} maxLength={100} />
                {fieldErrors.firstName && <span className="form-error">{fieldErrors.firstName}</span>}
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="lastName">Last name</label>
                <input id="lastName" className={fieldClass('lastName')} value={form.lastName} onChange={(e) => update('lastName', e.target.value)} required minLength={2} maxLength={100} />
                {fieldErrors.lastName && <span className="form-error">{fieldErrors.lastName}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="dateOfBirth">Date of birth</label>
                <input id="dateOfBirth" type="date" className={fieldClass('dateOfBirth')} value={form.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => update('dateOfBirth', e.target.value)} />
                {fieldErrors.dateOfBirth && <span className="form-error">{fieldErrors.dateOfBirth}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="gender">Gender</label>
                <select id="gender" className="form-select" value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                  <option value="">Not specified</option>
                  {GENDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="phone">Phone</label>
                <input id="phone" className={fieldClass('phone')} value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="9876543210" />
                {fieldErrors.phone && <span className="form-error">{fieldErrors.phone}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="bloodGroup">Blood group</label>
                <select id="bloodGroup" className="form-select" value={form.bloodGroup} onChange={(e) => update('bloodGroup', e.target.value)}>
                  <option value="">Not specified</option>
                  {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label" htmlFor="address">Address</label>
              <textarea id="address" className="form-textarea" value={form.address} onChange={(e) => update('address', e.target.value)} maxLength={500} />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => { setForm(toForm(profile)); setFieldErrors({}); }}>Reset</button>
            </div>
          </form>
        ) : null}
      </div>
    </main>
  );
}
