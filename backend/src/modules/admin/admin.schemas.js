import { z } from 'zod';
import { patientProfileSchema } from '../patients/patients.schemas.js';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:MM format.');

export const availabilityBlockSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0, 'Day must be 0 (Mon) to 6 (Sun).').max(6, 'Day must be 0 (Mon) to 6 (Sun).'),
    startTime: time,
    endTime: time,
  })
  .refine((b) => b.endTime > b.startTime, { message: 'End time must be after start time.', path: ['endTime'] });

/** Blocks on the same day must not overlap (mirrors slot generation assumptions). */
export const availabilityListSchema = z
  .array(availabilityBlockSchema)
  .max(28, 'Too many availability blocks.')
  .superRefine((blocks, ctx) => {
    const sorted = [...blocks].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev.dayOfWeek === cur.dayOfWeek && cur.startTime < prev.endTime) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Availability blocks overlap on day ${cur.dayOfWeek} (${prev.startTime}–${prev.endTime} and ${cur.startTime}–${cur.endTime}).` });
      }
    }
  });

const doctorProfileFields = {
  departmentId: z.string().uuid('Choose a department.'),
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters.').max(100),
  lastName: z.string().trim().min(2, 'Last name must be at least 2 characters.').max(100),
  specialization: z.string().trim().min(2, 'Specialization is required.').max(200),
  qualification: z.string().trim().min(2, 'Qualification is required.').max(200),
  experienceYears: z.union([z.coerce.number().int().min(0, 'Experience cannot be negative.').max(80), z.null()]).optional(),
  bio: z.union([z.string().trim().max(2000), z.null()]).optional(),
  phone: z.union([z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, 'Phone must be 7–20 digits.'), z.literal(''), z.null()]).optional(),
  consultationFee: z.union([z.coerce.number().min(0, 'Fee cannot be negative.').max(99999999.99), z.null()]).optional(),
  slotDurationMinutes: z.coerce.number().int().min(5, 'Slot must be at least 5 minutes.').max(240).optional(),
};

export const createDoctorSchema = z.object({
  email: z.string({ required_error: 'Email is required.' }).email('Please provide a valid email address.').toLowerCase().trim(),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, 'Password must be at least 8 characters.')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain an uppercase letter, a lowercase letter and a number.'),
  ...doctorProfileFields,
  availability: availabilityListSchema.optional().default([]),
});

export const updateDoctorSchema = z
  .object({ ...doctorProfileFields, isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });

export const replaceAvailabilitySchema = z.object({ availability: availabilityListSchema });

export const updatePatientSchema = patientProfileSchema
  .extend({ isActive: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });

export const idSchema = z.object({ id: z.string().uuid('Invalid id.') });
