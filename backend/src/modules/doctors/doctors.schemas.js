import { z } from 'zod';

export const doctorIdSchema = z.object({
  id: z.string().uuid('Invalid doctor id.'),
});

export const availabilityQuerySchema = z.object({
  date: z
    .string({ required_error: 'Date is required.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.'),
});
