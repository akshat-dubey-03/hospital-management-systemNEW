import { z } from 'zod';

const nonBlank = (label, max) =>
  z
    .string({ required_error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

export const prescriptionSchema = z.object({
  medicineName: nonBlank('Medicine name', 200),
  dosage: nonBlank('Dosage', 100),
  frequency: nonBlank('Frequency', 100),
  duration: nonBlank('Duration', 100),
});

export const createRecordSchema = z.object({
  appointmentId: z.string().uuid('Invalid appointment id.'),
  diagnosis: nonBlank('Diagnosis', 5000),
  treatmentNotes: z.string().trim().max(5000).optional().nullable(),
  prescriptions: z.array(prescriptionSchema).max(20, 'At most 20 prescriptions per request.').optional().default([]),
});

export const updateRecordSchema = z
  .object({
    diagnosis: nonBlank('Diagnosis', 5000).optional(),
    treatmentNotes: z.string().trim().max(5000).optional().nullable(),
  })
  .refine((v) => v.diagnosis !== undefined || v.treatmentNotes !== undefined, {
    message: 'Provide a diagnosis or treatment notes to update.',
  });

export const addPrescriptionsSchema = z.object({
  prescriptions: z.array(prescriptionSchema).min(1, 'Add at least one prescription.').max(20),
});

export const recordIdSchema = z.object({ id: z.string().uuid('Invalid medical record id.') });

export const prescriptionParamsSchema = z.object({
  id: z.string().uuid('Invalid medical record id.'),
  prescriptionId: z.string().uuid('Invalid prescription id.'),
});
