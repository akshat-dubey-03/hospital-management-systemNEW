import { useEffect, useState } from 'react';
import { AlertCircle, FileText } from 'lucide-react';
import { recordsService } from '../../services/records.service.js';
import { apiErrorMessage } from '../../utils/apiError.js';
import { formatDate, formatDoctorName } from '../../utils/date.js';
import PrescriptionTable from '../../components/records/PrescriptionTable.jsx';

export default function PatientRecordsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    recordsService
      .list()
      .then((data) => active && setRecords(data))
      .catch((err) => active && setError(apiErrorMessage(err, 'Unable to load your medical records.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>Medical Records</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Diagnoses and prescriptions written by your doctors.</p>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}><AlertCircle size={16} /> {error}</div>}
        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
        {!loading && !error && records.length === 0 && (
          <div className="alert alert-info">No medical records yet. They appear here after a doctor records your visit.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {records.map((record) => (
            <article className="card" key={record.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
                <div>
                  <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={18} /> {record.diagnosis}</h2>
                  <p className="text-sm text-muted">
                    {formatDate(record.recordDate)} · {record.doctor ? formatDoctorName(record.doctor) : ''}
                    {record.doctor?.department ? ` · ${record.doctor.department}` : ''}
                  </p>
                </div>
                {record.appointment && (
                  <p className="text-sm text-muted">Visit: {formatDate(record.appointment.appointmentDate)} {record.appointment.startTime}</p>
                )}
              </div>
              {record.treatmentNotes && (
                <div className="panel-muted" style={{ marginBottom: 'var(--space-3)' }}>
                  <strong className="text-sm">Treatment notes</strong>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{record.treatmentNotes}</p>
                </div>
              )}
              <PrescriptionTable prescriptions={record.prescriptions} />
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
