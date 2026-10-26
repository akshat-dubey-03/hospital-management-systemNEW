import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { billsService } from '../../services/bills.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { apiErrorMessage } from '../../utils/apiError.js';
import { formatDate, formatDoctorName, formatMoney } from '../../utils/date.js';

export default function PatientBillsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    billsService
      .list()
      .then((data) => active && setBills(data))
      .catch((err) => active && setError(apiErrorMessage(err, 'Unable to load your bills.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const outstanding = useMemo(
    () => bills.filter((b) => b.paymentStatus === 'PENDING').reduce((sum, b) => sum + Number(b.amount), 0),
    [bills]
  );

  return (
    <main className="page-content" style={{ marginLeft: 0 }}>
      <div className="container">
        <div className="card-header">
          <div>
            <h1>My Bills</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Consultation bills for completed appointments. Payments are recorded by the hospital.</p>
          </div>
          {!loading && bills.length > 0 && (
            <div className="stat-card"><div><p className="stat-label">Outstanding</p><p className="stat-value">{formatMoney(outstanding)}</p></div></div>
          )}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}><AlertCircle size={16} /> {error}</div>}
        {loading && <div className="loading-wrapper"><div className="spinner" /></div>}
        {!loading && !error && bills.length === 0 && <div className="alert alert-info">No bills yet. A bill is created when a visit is completed.</div>}

        {!loading && bills.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Bill date</th><th>Visit</th><th>Doctor</th><th>Amount</th><th>Status</th><th>Paid on</th></tr></thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id}>
                    <td>{formatDate(bill.billDate)}</td>
                    <td>{bill.appointment ? `${formatDate(bill.appointment.appointmentDate)} ${bill.appointment.startTime}` : '—'}</td>
                    <td>{bill.appointment?.doctor ? `${formatDoctorName(bill.appointment.doctor)}${bill.appointment.doctor.department ? ` · ${bill.appointment.doctor.department}` : ''}` : '—'}</td>
                    <td><strong>{formatMoney(bill.amount)}</strong></td>
                    <td><StatusBadge status={bill.paymentStatus} /></td>
                    <td>{bill.paidAt ? formatDate(String(bill.paidAt).slice(0, 10)) : '—'}</td>
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
