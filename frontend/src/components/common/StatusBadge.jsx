// src/components/common/StatusBadge.jsx
// Displays appointment/query status with appropriate color coding.

const STATUS_MAP = {
  BOOKED:               { label: 'Booked',       className: 'badge-booked' },
  CONFIRMED:            { label: 'Confirmed',     className: 'badge-confirmed' },
  COMPLETED:            { label: 'Completed',     className: 'badge-completed' },
  CANCELLED_BY_PATIENT: { label: 'Cancelled',     className: 'badge-cancelled' },
  CANCELLED_BY_DOCTOR:  { label: 'Cancelled',     className: 'badge-cancelled' },
  CANCELLED_BY_ADMIN:   { label: 'Cancelled',     className: 'badge-cancelled' },
  OPEN:                 { label: 'Open',          className: 'badge-open' },
  IN_PROGRESS:          { label: 'In Progress',   className: 'badge-in-progress' },
  RESOLVED:             { label: 'Resolved',      className: 'badge-resolved' },
  CLOSED:               { label: 'Closed',        className: 'badge-cancelled' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_MAP[status] || { label: status, className: 'badge-booked' };
  return (
    <span className={`badge ${config.className}`}>
      {config.label}
    </span>
  );
}
