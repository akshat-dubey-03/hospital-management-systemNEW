export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
}

export function formatDoctorName(doctor) {
  return `Dr. ${doctor.firstName} ${doctor.lastName}`;
}

export function canCancelAppointment(appointment) {
  if (!['BOOKED', 'CONFIRMED'].includes(appointment.status)) return false;
  return new Date(`${appointment.appointmentDate}T${appointment.startTime}:00`) > new Date();
}

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function formatMoney(amount) {
  if (amount === null || amount === undefined || amount === '') return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(amount));
}

export function formatPersonName(person) {
  if (!person) return '';
  return `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
}
