// src/modules/auth/auth.schemas.js
// Zod validation schemas for authentication endpoints.

import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .email('Please provide a valid email address.')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, 'Password must be at least 8 characters.')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number.'
    ),
  firstName: z
    .string({ required_error: 'First name is required.' })
    .min(2, 'First name must be at least 2 characters.')
    .max(100)
    .trim(),
  lastName: z
    .string({ required_error: 'Last name is required.' })
    .min(2, 'Last name must be at least 2 characters.')
    .max(100)
    .trim(),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .email('Please provide a valid email address.')
    .toLowerCase()
    .trim(),
  password: z.string({ required_error: 'Password is required.' }),
  role: z.enum(['PATIENT', 'DOCTOR', 'ADMIN']).optional(),
});
