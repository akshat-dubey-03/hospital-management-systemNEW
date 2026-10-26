// src/utils/actors.js
// Resolves the authenticated user's role profile (patient / doctor row).
// The JWT only carries the user id; ownership checks always use these DB rows.

import { prisma } from '../config/database.js';
import { ApiError } from './ApiError.js';

export async function requirePatientProfile(userId, db = prisma) {
  const patient = await db.patient.findUnique({ where: { userId } });
  if (!patient) throw ApiError.forbidden('Patient profile not found.');
  return patient;
}

export async function requireDoctorProfile(userId, db = prisma) {
  const doctor = await db.doctor.findUnique({ where: { userId } });
  if (!doctor) throw ApiError.forbidden('Doctor profile not found.');
  return doctor;
}
