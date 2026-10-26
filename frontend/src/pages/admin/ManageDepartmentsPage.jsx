import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { departmentsService } from '../../services/departments.service.js';
import { apiErrorMessage } from '../../utils/apiError.js';

const EMPTY = { name: '', description: '' };

export default function ManageDepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  async function load() {
    try {
      setDepartments(await departmentsService.list());
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to load departments.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function run(action, success) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await load();
      return true;
    } catch (err) {
      setError(apiErrorMessage(err, 'The request failed.'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { name: form.name.trim(), description: form.description.trim() || null };
    const ok = editingId
      ? await run(() => departmentsService.update(editingId, payload), 'Department updated.')
      : await run(() => departmentsService.create(payload), 'Department created.');
    if (ok) {
      setForm(EMPTY);
      setEditingId(null);
    }
  }

  function startEdit(d) {
    setEditingId(d.id);
    setForm({ name: d.name, description: d.description || '' });
    setMessage('');
    setError('');
  }

  async function handleDelete(d) {
    if (confirmDeleteId !== d.id) {
      setConfirmDeleteId(d.id);
      return;
    }
    setConfirmDeleteId(null);
    await run(() => departmentsService.remove(d.id), `Deleted ${d.name}.`);
  }

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>Departments</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>A department can only be deleted when no doctor belongs to it.</p>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}><AlertCircle size={16} /> {error}</div>}
        {message && <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>{message}</div>}

        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="card-title">{editingId ? 'Edit department' : 'Add department'}</h2>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label required" htmlFor="dept-name">Name</label>
              <input id="dept-name" className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required minLength={2} maxLength={100} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label" htmlFor="dept-desc">Description</label>
              <input id="dept-desc" className="form-input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} maxLength={2000} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save changes' : 'Add department'}</button>
            {editingId && <button type="button" className="btn btn-secondary" onClick={() => { setEditingId(null); setForm(EMPTY); }}>Cancel edit</button>}
          </div>
        </form>

        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
        {!loading && departments.length === 0 && <div className="alert alert-info">No departments yet.</div>}
        {!loading && departments.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Name</th><th>Description</th><th>Doctors (active)</th><th>Actions</th></tr></thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.name}</strong></td>
                    <td style={{ maxWidth: 420 }}>{d.description || '—'}</td>
                    <td>{d.doctorCount} ({d.activeDoctorCount})</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => startEdit(d)}>Edit</button>
                        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => handleDelete(d)} onBlur={() => setConfirmDeleteId(null)}>
                          {confirmDeleteId === d.id ? 'Click again to delete' : 'Delete'}
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
