import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calendar, IndianRupee } from 'lucide-react';
import { doctorsService } from '../../services/doctors.service.js';
import { formatDoctorName } from '../../utils/date.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DoctorProfilePage() {
  const { id } = useParams();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDoctor() {
      try {
        setDoctor(await doctorsService.get(id));
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load doctor profile.');
      } finally {
        setLoading(false);
      }
    }
    loadDoctor();
  }, [id]);

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <Link to="/patient/doctors" className="btn btn-secondary">Back</Link>
          {doctor && <Link to={`/patient/doctors/${doctor.id}/book`} className="btn btn-primary"><Calendar size={16} /> Book Appointment</Link>}
        </div>

        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
        {error && <div className="alert alert-error">{error}</div>}
        {doctor && (
          <div className="card">
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>{doctor.department?.name}</p>
            <h1>{formatDoctorName(doctor)}</h1>
            <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-primary-700)', fontWeight: 700 }}>{doctor.specialization}</p>
            <p style={{ marginTop: 'var(--space-4)' }}>{doctor.bio || 'No bio provided.'}</p>

            <div className="grid-3" style={{ marginTop: 'var(--space-8)' }}>
              <div className="stat-card"><div><p className="stat-label">Qualification</p><p>{doctor.qualification}</p></div></div>
              <div className="stat-card"><div><p className="stat-label">Experience</p><p>{doctor.experienceYears ?? 0} years</p></div></div>
              <div className="stat-card"><IndianRupee size={20} /><div><p className="stat-label">Fee</p><p>{doctor.consultationFee ?? 'N/A'}</p></div></div>
            </div>

            <h2 style={{ fontSize: 'var(--text-xl)', marginTop: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>Weekly Availability</h2>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Day</th><th>Time</th></tr></thead>
                <tbody>
                  {doctor.availability?.map((block) => (
                    <tr key={block.id}><td>{DAYS[block.dayOfWeek]}</td><td>{block.startTime} - {block.endTime}</td></tr>
                  ))}
                  {doctor.availability?.length === 0 && <tr><td colSpan="2">No availability configured.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
