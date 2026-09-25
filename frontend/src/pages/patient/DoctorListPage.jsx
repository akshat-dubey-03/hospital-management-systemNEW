import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Stethoscope } from 'lucide-react';
import { doctorsService } from '../../services/doctors.service.js';
import { formatDoctorName } from '../../utils/date.js';

export default function DoctorListPage() {
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadDoctors() {
      setLoading(true);
      setError('');
      try {
        const data = await doctorsService.list(search ? { search } : {});
        if (active) setDoctors(data);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Unable to load doctors.');
      } finally {
        if (active) setLoading(false);
      }
    }
    const timer = setTimeout(loadDoctors, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>Find Doctors</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Choose a doctor and check appointment slots.</p>
          </div>
          <Link to="/patient/dashboard" className="btn btn-secondary">Dashboard</Link>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 'var(--space-4)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input className="form-input" style={{ paddingLeft: 'calc(var(--space-4) + 16px + var(--space-2))' }} placeholder="Search by doctor, department, or specialization" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
        {!loading && !error && doctors.length === 0 && <div className="alert alert-info">No doctors found.</div>}

        <div className="grid-3">
          {doctors.map((doctor) => (
            <Link className="card" key={doctor.id} to={`/patient/doctors/${doctor.id}`}>
              <Stethoscope size={28} style={{ color: 'var(--color-primary-600)', marginBottom: 'var(--space-4)' }} />
              <h2 className="card-title">{formatDoctorName(doctor)}</h2>
              <p style={{ fontWeight: 600 }}>{doctor.specialization}</p>
              <p style={{ color: 'var(--color-text-secondary)' }}>{doctor.department?.name}</p>
              <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}>
                {doctor.experienceYears ?? 0} years experience · {doctor.slotDurationMinutes} min slots
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
