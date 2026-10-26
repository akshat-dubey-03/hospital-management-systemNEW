import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, Search } from 'lucide-react';
import { patientsService } from '../../services/patients.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import PrescriptionTable from '../../components/records/PrescriptionTable.jsx';
import { apiErrorMessage } from '../../utils/apiError.js';
import { formatDate, formatPersonName } from '../../utils/date.js';

// Doctor view: patients who have appointments with this doctor, and — for the
// selected patient — the visits and records that belong to this doctor.
export default function PatientSearchPage() {
  const [params, setParams] = useSearchParams();
  const openId = params.get('open');
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await patientsService.listForDoctor(search ? { search } : {});
        if (active) setPatients(data);
      } catch (err) {
        if (active) setError(apiErrorMessage(err, 'Unable to load patients.'));
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    if (!openId) {
      setSelected(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setDetailError('');
    patientsService
      .getForDoctor(openId)
      .then((data) => active && setSelected(data))
      .catch((err) => active && setDetailError(apiErrorMessage(err, 'Unable to load patient.')))
      .finally(() => active && setDetailLoading(false));
    return () => {
      active = false;
    };
  }, [openId]);

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>My Patients</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Patients who have booked with you. Only your own visits and records are shown.</p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-6)', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 'calc(var(--space-6) + var(--space-4))', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input className="form-input" style={{ paddingLeft: 'calc(var(--space-4) + 16px + var(--space-2))' }} placeholder="Search by patient name" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}><AlertCircle size={16} /> {error}</div>}
        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
        {!loading && !error && patients.length === 0 && <div className="alert alert-info">No patients found.</div>}

        {!loading && patients.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Patient</th><th>Gender</th><th>Blood group</th><th>Phone</th><th>Visits</th><th>Last visit</th><th /></tr></thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id} style={p.id === openId ? { background: 'var(--color-primary-50)' } : undefined}>
                    <td><strong>{formatPersonName(p)}</strong></td>
                    <td>{p.gender?.replaceAll('_', ' ').toLowerCase() || '—'}</td>
                    <td>{p.bloodGroup || '—'}</td>
                    <td>{p.phone || '—'}</td>
                    <td>{p.appointmentCount}</td>
                    <td>{p.lastAppointment ? <>{formatDate(p.lastAppointment.appointmentDate)} <StatusBadge status={p.lastAppointment.status} /></> : '—'}</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => setParams({ open: p.id })}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {openId && (
          <section className="card" style={{ marginTop: 'var(--space-6)' }}>
            {detailLoading && <div className="loading-wrapper"><div className="spinner" /></div>}
            {detailError && <div className="alert alert-error">{detailError}</div>}
            {selected && !detailLoading && (
              <>
                <div className="card-header">
                  <h2 className="card-title">{formatPersonName(selected)}</h2>
                  <button className="btn btn-secondary btn-sm" onClick={() => setParams({})}>Close</button>
                </div>
                <dl className="kv" style={{ marginBottom: 'var(--space-6)' }}>
                  <dt>Date of birth</dt><dd>{selected.dateOfBirth ? formatDate(selected.dateOfBirth) : '—'}</dd>
                  <dt>Blood group</dt><dd>{selected.bloodGroup || '—'}</dd>
                  <dt>Phone</dt><dd>{selected.phone || '—'}</dd>
                  <dt>Address</dt><dd>{selected.address || '—'}</dd>
                </dl>
                <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>Visits with you</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {selected.appointments.map((a) => (
                    <div key={a.id} className="panel-muted">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
                        <strong>{formatDate(a.appointmentDate)} · {a.startTime} - {a.endTime}</strong>
                        <span className="row-actions"><StatusBadge status={a.status} /><Link to={`/doctor/appointments/${a.id}`} className="btn btn-secondary btn-sm">Open</Link></span>
                      </div>
                      <p className="text-sm text-muted">Reason: {a.reasonForVisit || 'Not provided'}</p>
                      {a.medicalRecord ? (
                        <div style={{ marginTop: 'var(--space-3)' }}>
                          <p><strong>Diagnosis:</strong> {a.medicalRecord.diagnosis}</p>
                          {a.medicalRecord.treatmentNotes && <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{a.medicalRecord.treatmentNotes}</p>}
                          <div style={{ marginTop: 'var(--space-2)' }}><PrescriptionTable prescriptions={a.medicalRecord.prescriptions} /></div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted" style={{ marginTop: 'var(--space-2)' }}>No medical record for this visit.</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
