import { z } from 'zod';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Optional profile fields: '' or null clears the value.
const optionalText = (max) => z.union([z.string().trim().max(max), z.null()]).optional();

export const patientProfileSchema = z
  .object({
    firstName: z.string().trim().min(2, 'First name must be at least 2 characters.').max(100).optional(),
    lastName: z.string().trim().min(2, 'Last name must be at least 2 characters.').max(100).optional(),
    dateOfBirth: z
      .union([
        z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must use YYYY-MM-DD format.')
          .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Invalid date of birth.')
          .refine((v) => new Date(`${v}T00:00:00Z`) <= new Date(), 'Date of birth cannot be in the future.'),
        z.literal(''),
        z.null(),
      ])
      .optional(),
    gender: z.union([z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']), z.literal(''), z.null()]).optional(),
    phone: z
      .union([z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, 'Phone must be 7–20 digits (spaces, + and - allowed).'), z.literal(''), z.null()])
      .optional(),
    address: optionalText(500),
    bloodGroup: z.union([z.enum(BLOOD_GROUPS), z.literal(''), z.null()]).optional(),
  })
  .strict();
