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
