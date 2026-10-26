// Read-only (or removable, when onRemove is given) list of prescription lines.

export default function PrescriptionTable({ prescriptions = [], onRemove, removingId }) {
  if (!prescriptions.length) {
    return <p className="text-sm text-muted">No prescriptions on this record.</p>;
  }
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th>
            {onRemove && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {prescriptions.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.medicineName}</strong></td>
              <td>{p.dosage}</td>
              <td>{p.frequency}</td>
              <td>{p.duration}</td>
              {onRemove && (
                <td>
                  <button type="button" className="btn btn-danger btn-sm" disabled={removingId === p.id} onClick={() => onRemove(p)}>
                    {removingId === p.id ? 'Removing...' : 'Remove'}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
