import { z } from 'zod';

const appointmentDate = z
  .string({ required_error: 'Appointment date is required.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Appointment date must use YYYY-MM-DD format.');

const time = z
  .string({ required_error: 'Start time is required.' })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:MM format.');

export const appointmentIdSchema = z.object({
  id: z.string().uuid('Invalid appointment id.'),
});

export const bookAppointmentSchema = z.object({
  doctorId: z.string().uuid('Invalid doctor id.'),
  appointmentDate,
  startTime: time,
  reasonForVisit: z.string().trim().max(1000).optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED_BY_DOCTOR', 'CANCELLED_BY_ADMIN']),
  notes: z.string().trim().max(2000).optional(),
  cancellationReason: z.string().trim().max(1000).optional(),
});

export const cancelAppointmentSchema = z.object({
  cancellationReason: z.string().trim().max(1000).optional(),
});
