// src/utils/serialize.js
// Small shared helpers for turning Prisma rows into API JSON.

/** 'YYYY-MM-DD' for a DATE column (Prisma returns it as a UTC-midnight Date). */
export function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** DECIMAL → number (Prisma returns Decimal objects). null stays null. */
export function toMoney(value) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

/** Shapes a Bill row for responses. */
export function toBillResponse(bill) {
  if (!bill) return null;
  return {
    id: bill.id,
    appointmentId: bill.appointmentId,
    amount: toMoney(bill.amount),
    billDate: toDateOnly(bill.billDate),
    paymentStatus: bill.paymentStatus,
    paidAt: bill.paidAt ?? null,
    createdAt: bill.createdAt,
    updatedAt: bill.updatedAt,
  };
}

/** Shapes a MedicalRecord row (optionally with prescriptions) for responses. */
export function toMedicalRecordResponse(record) {
  if (!record) return null;
  return {
    id: record.id,
    appointmentId: record.appointmentId,
    doctorId: record.doctorId,
    diagnosis: record.diagnosis,
    treatmentNotes: record.treatmentNotes,
    recordDate: toDateOnly(record.recordDate),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    prescriptions: (record.prescriptions || []).map(toPrescriptionResponse),
  };
}

export function toPrescriptionResponse(p) {
  return {
    id: p.id,
    medicalRecordId: p.medicalRecordId,
    medicineName: p.medicineName,
    dosage: p.dosage,
    frequency: p.frequency,
    duration: p.duration,
    createdAt: p.createdAt,
  };
}
