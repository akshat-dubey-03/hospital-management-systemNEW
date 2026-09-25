import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { appointmentsService } from '../../services/appointments.service.js';
import { doctorsService } from '../../services/doctors.service.js';
import { formatDoctorName, todayInputValue } from '../../utils/date.js';

export default function BookAppointmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [date, setDate] = useState(todayInputValue());
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function loadAvailability() {
      setLoading(true);
      setError('');
      setSelectedSlot(null);
      try {
        const data = await doctorsService.availability(id, date);
        setDoctor(data.doctor);
        setSlots(data.slots);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load availability.');
      } finally {
        setLoading(false);
      }
    }
    loadAvailability();
  }, [id, date]);

  async function handleBook() {
    if (!selectedSlot) return;
    setBooking(true);
    setError('');
    setSuccess('');
    try {
      await appointmentsService.book({
        doctorId: id,
        appointmentDate: date,
        startTime: selectedSlot.startTime,
        reasonForVisit,
      });
      setSuccess('Appointment booked successfully.');
      setTimeout(() => navigate('/patient/appointments'), 900);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to book appointment.');
    } finally {
      setBooking(false);
    }
  }

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>Book Appointment</h1>
            {doctor && <p style={{ color: 'var(--color-text-secondary)' }}>{formatDoctorName(doctor)} · {doctor.department?.name}</p>}
          </div>
          <Link to={`/patient/doctors/${id}`} className="btn btn-secondary">Profile</Link>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>{success}</div>}

        <div className="card">
          <div className="form-group" style={{ maxWidth: 260, marginBottom: 'var(--space-6)' }}>
            <label className="form-label required">Appointment Date</label>
            <input className="form-input" type="date" min={todayInputValue()} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
          {!loading && slots.length === 0 && <div className="alert alert-info">No slots are configured for this date.</div>}
          {!loading && slots.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>
              {slots.map((slot) => (
                <button
                  key={slot.startTime}
                  className={`btn ${selectedSlot?.startTime === slot.startTime ? 'btn-primary' : 'btn-secondary'}`}
                  disabled={!slot.isAvailable}
                  onClick={() => setSelectedSlot(slot)}
                  type="button"
                >
                  {slot.startTime} - {slot.endTime}
                </button>
              ))}
            </div>
          )}

          <div className="form-group" style={{ marginTop: 'var(--space-6)' }}>
            <label className="form-label">Reason for Visit</label>
            <textarea className="form-textarea" value={reasonForVisit} onChange={(e) => setReasonForVisit(e.target.value)} maxLength={1000} />
          </div>

          <button className="btn btn-primary btn-lg" disabled={!selectedSlot || booking} onClick={handleBook} style={{ marginTop: 'var(--space-6)' }}>
            {booking ? 'Booking...' : 'Confirm Appointment'}
          </button>
        </div>
      </div>
    </main>
  );
}
