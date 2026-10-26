import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { appointmentsService } from '../../services/appointments.service.js';
import { recordsService } from '../../services/records.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import PrescriptionTable from '../../components/records/PrescriptionTable.jsx';
import { apiErrorMessage, apiFieldErrors } from '../../utils/apiError.js';
import { formatDate, formatPersonName } from '../../utils/date.js';

const EMPTY_RX = { medicineName: '', dosage: '', frequency: '', duration: '' };
const RECORDABLE = ['CONFIRMED', 'COMPLETED'];

export default function DoctorAppointmentDetailPage() {
  const { id } = useParams();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Record form (create or edit) and new prescription rows
  const [diagnosis, setDiagnosis] = useState('');
  const [treatmentNotes, setTreatmentNotes] = useState('');
  const [rxRows, setRxRows] = useState([]);

  const load = useCallback(async () => {
    try {
      const data = await appointmentsService.get(id);
      setAppointment(data);
      setDiagnosis(data.medicalRecord?.diagnosis ?? '');
      setTreatmentNotes(data.medicalRecord?.treatmentNotes ?? '');
      setRxRows(data.medicalRecord ? [] : [{ ...EMPTY_RX }]);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to load this appointment.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const record = appointment?.medicalRecord;
  const canWrite = appointment && RECORDABLE.includes(appointment.status);

  function updateRx(index, key, value) {
    setRxRows((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  // Rows the doctor left completely empty are ignored; partly filled rows are sent and validated.
  const filledRx = () => rxRows.filter((row) => Object.values(row).some((v) => v.trim() !== ''));

  async function run(action, successMessage) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    setFieldErrors({});
    try {
      const result = await action();
      setMessage(typeof successMessage === 'function' ? successMessage(result) : successMessage);
      await load();
    } catch (err) {
      setFieldErrors(apiFieldErrors(err));
      setError(apiErrorMessage(err, 'The request failed.'));
    } finally {
      setBusy(false);
    }
  }

  function handleCreate(e) {
    e.preventDefault();
    run(() => recordsService.create({ appointmentId: id, diagnosis, treatmentNotes, prescriptions: filledRx() }), 'Medical record saved.');
  }

  function handleUpdate(e) {
    e.preventDefault();
    run(() => recordsService.update(record.id, { diagnosis, treatmentNotes }), 'Medical record updated.');
  }

  function handleAddPrescriptions(e) {
    e.preventDefault();
    const rows = filledRx();
    if (!rows.length) {
      setError('Fill in at least one prescription row.');
      return;
    }
    run(() => recordsService.addPrescriptions(record.id, rows), `Added ${rows.length} prescription(s).`);
  }

  async function handleRemove(prescription) {
    setRemovingId(prescription.id);
    await run(() => recordsService.removePrescription(record.id, prescription.id), `Removed ${prescription.medicineName}.`);
    setRemovingId(null);
  }

  function handleStatus(status) {
    run(() => appointmentsService.updateStatus(id, { status }), (result) => result.message || 'Appointment updated.');
  }

  const rxEditor = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {rxRows.map((row, index) => (
        <div key={index} className="form-grid panel-muted" style={{ alignItems: 'end' }}>
          {[
            ['medicineName', 'Medicine', 'Paracetamol'],
            ['dosage', 'Dosage', '500 mg'],
            ['frequency', 'Frequency', 'Twice daily'],
            ['duration', 'Duration', '5 days'],
          ].map(([key, label, placeholder]) => (
            <div className="form-group" key={key}>
              <label className="form-label" htmlFor={`rx-${index}-${key}`}>{label}</label>
              <input
                id={`rx-${index}-${key}`}
                className={`form-input ${fieldErrors[`prescriptions.${index}.${key}`] ? 'error' : ''}`}
                value={row[key]}
                placeholder={placeholder}
                maxLength={key === 'medicineName' ? 200 : 100}
                onChange={(e) => updateRx(index, key, e.target.value)}
              />
              {fieldErrors[`prescriptions.${index}.${key}`] && <span className="form-error">{fieldErrors[`prescriptions.${index}.${key}`]}</span>}
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRxRows((rows) => rows.filter((_, i) => i !== index))} aria-label="Remove row">
            <Trash2 size={14} /> Remove row
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRxRows((rows) => [...rows, { ...EMPTY_RX }])}>
          <Plus size={14} /> Add prescription row
        </button>
      </div>
    </div>
  );

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>Appointment</h1>
            {appointment && (
              <p style={{ color: 'var(--color-text-secondary)' }}>
                {formatDate(appointment.appointmentDate)} · {appointment.startTime} - {appointment.endTime}
              </p>
            )}
          </div>
          <Link to="/doctor/appointments" className="btn btn-secondary">Back to appointments</Link>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}><AlertCircle size={16} /> {error}</div>}
        {message && <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>{message}</div>}
        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}

        {appointment && (
          <>
            <div className="grid-2">
              <section className="card">
                <h2 className="card-title">Patient</h2>
                <dl className="kv">
                  <dt>Name</dt><dd>{formatPersonName(appointment.patient)}</dd>
                  <dt>Date of birth</dt><dd>{appointment.patient?.dateOfBirth ? formatDate(appointment.patient.dateOfBirth) : '—'}</dd>
                  <dt>Gender</dt><dd>{appointment.patient?.gender?.replaceAll('_', ' ').toLowerCase() || '—'}</dd>
                  <dt>Blood group</dt><dd>{appointment.patient?.bloodGroup || '—'}</dd>
                  <dt>Phone</dt><dd>{appointment.patient?.phone || '—'}</dd>
                  <dt>Address</dt><dd>{appointment.patient?.address || '—'}</dd>
                </dl>
                <Link to={`/doctor/patients?open=${appointment.patient?.id}`} className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-4)' }}>Visit history</Link>
              </section>
              <section className="card">
                <h2 className="card-title">Visit</h2>
                <dl className="kv">
                  <dt>Status</dt><dd><StatusBadge status={appointment.status} /></dd>
                  <dt>Reason</dt><dd>{appointment.reasonForVisit || 'Not provided'}</dd>
                  {appointment.cancellationReason && (<><dt>Cancellation</dt><dd>{appointment.cancellationReason}</dd></>)}
                </dl>
                <div className="form-actions">
                  {appointment.status === 'BOOKED' && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => handleStatus('CONFIRMED')}>Confirm appointment</button>}
                  {appointment.status === 'CONFIRMED' && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => handleStatus('COMPLETED')}>Mark completed (generates bill)</button>}
                </div>
              </section>
            </div>

            <section className="card" style={{ marginTop: 'var(--space-6)' }}>
              <h2 className="card-title">Medical record</h2>
              {!canWrite && !record && (
                <div className="alert alert-info">A medical record can be written once the appointment is confirmed.</div>
              )}

              {canWrite && !record && (
                <form onSubmit={handleCreate}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="diagnosis">Diagnosis</label>
                    <textarea id="diagnosis" className={`form-textarea ${fieldErrors.diagnosis ? 'error' : ''}`} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} required maxLength={5000} />
                    {fieldErrors.diagnosis && <span className="form-error">{fieldErrors.diagnosis}</span>}
                  </div>
                  <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                    <label className="form-label" htmlFor="treatmentNotes">Treatment notes</label>
                    <textarea id="treatmentNotes" className="form-textarea" value={treatmentNotes} onChange={(e) => setTreatmentNotes(e.target.value)} maxLength={5000} />
                  </div>
                  <h3 style={{ fontSize: 'var(--text-lg)', margin: 'var(--space-6) 0 var(--space-3)' }}>Prescriptions</h3>
                  {rxEditor}
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save medical record'}</button>
                  </div>
                </form>
              )}

              {record && (
                <>
                  <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-3)' }}>Recorded on {formatDate(record.recordDate)}</p>
                  <form onSubmit={handleUpdate}>
                    <div className="form-group">
                      <label className="form-label required" htmlFor="diagnosis">Diagnosis</label>
                      <textarea id="diagnosis" className={`form-textarea ${fieldErrors.diagnosis ? 'error' : ''}`} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} required maxLength={5000} />
                      {fieldErrors.diagnosis && <span className="form-error">{fieldErrors.diagnosis}</span>}
                    </div>
                    <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                      <label className="form-label" htmlFor="treatmentNotes">Treatment notes</label>
                      <textarea id="treatmentNotes" className="form-textarea" value={treatmentNotes} onChange={(e) => setTreatmentNotes(e.target.value)} maxLength={5000} />
                    </div>
                    <div className="form-actions">
                      <button
                        type="submit"
                        className="btn btn-secondary"
                        disabled={busy || (diagnosis === record.diagnosis && (treatmentNotes || '') === (record.treatmentNotes || ''))}
                      >
                        Save changes
                      </button>
                    </div>
                  </form>

                  <h3 style={{ fontSize: 'var(--text-lg)', margin: 'var(--space-6) 0 var(--space-3)' }}>Prescriptions</h3>
                  <PrescriptionTable prescriptions={record.prescriptions} onRemove={handleRemove} removingId={removingId} />
                  <form onSubmit={handleAddPrescriptions} style={{ marginTop: 'var(--space-4)' }}>
                    {rxEditor}
                    {rxRows.length > 0 && (
                      <div className="form-actions">
                        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Add prescriptions'}</button>
                      </div>
                    )}
                  </form>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
