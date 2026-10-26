// src/modules/patients/patients.routes.js
// Patient profile (self-service) and the doctor's view of their own patients.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { validate, validateParams } from '../../middleware/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { requireDoctorProfile } from '../../utils/actors.js';
import { toDateOnly } from '../../utils/serialize.js';
import { patientProfileSchema } from './patients.schemas.js';

const router = Router();

const idSchema = z.object({ id: z.string().uuid('Invalid patient id.') });

// GET /api/patients/me — the signed-in patient's profile
router.get('/me', authMiddleware, roleGuard('PATIENT'), async (req, res, next) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { email: true, createdAt: true } } },
    });
    if (!patient) throw ApiError.forbidden('Patient profile not found.');
    new ApiResponse(200, { patient: toPatientProfile(patient) }).send(res);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/patients/me — update own profile (email/password are not changed here)
router.patch('/me', authMiddleware, roleGuard('PATIENT'), validate(patientProfileSchema), async (req, res, next) => {
  try {
    const patient = await prisma.patient.update({
      where: { userId: req.user.id },
      data: toPatientUpdateData(req.body),
      include: { user: { select: { email: true, createdAt: true } } },
    });
    new ApiResponse(200, { patient: toPatientProfile(patient) }, 'Profile updated.').send(res);
  } catch (err) {
    next(err);
  }
});

// GET /api/patients — doctor: patients who have at least one appointment with them
router.get('/', authMiddleware, roleGuard('DOCTOR'), async (req, res, next) => {
  try {
    const doctor = await requireDoctorProfile(req.user.id);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const patients = await prisma.patient.findMany({
      where: {
        appointments: { some: { doctorId: doctor.id } },
        ...(search
          ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] }
          : {}),
      },
      include: {
        appointments: {
          where: { doctorId: doctor.id },
          select: { id: true, appointmentDate: true, startTime: true, status: true },
          orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    new ApiResponse(200, {
      patients: patients.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender,
        dateOfBirth: toDateOnly(p.dateOfBirth),
        phone: p.phone,
        bloodGroup: p.bloodGroup,
        appointmentCount: p.appointments.length,
        lastAppointment: p.appointments[0]
          ? { id: p.appointments[0].id, appointmentDate: toDateOnly(p.appointments[0].appointmentDate), startTime: p.appointments[0].startTime, status: p.appointments[0].status }
          : null,
      })),
    }).send(res);
  } catch (err) {
    next(err);
  }
});

// GET /api/patients/:id — doctor: one of their patients, with the visits and
// records that belong to this doctor only.
router.get('/:id', authMiddleware, roleGuard('DOCTOR'), validateParams(idSchema), async (req, res, next) => {
  try {
    const doctor = await requireDoctorProfile(req.user.id);
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        appointments: {
          where: { doctorId: doctor.id },
          include: { medicalRecord: { include: { prescriptions: { orderBy: { createdAt: 'asc' } } } } },
          orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
        },
      },
    });
    if (!patient || patient.appointments.length === 0) {
      // Same response whether the patient does not exist or is not this doctor's patient.
      throw ApiError.notFound('Patient not found among your appointments.');
    }

    new ApiResponse(200, {
      patient: {
        ...toPatientProfile(patient),
        appointments: patient.appointments.map((a) => ({
          id: a.id,
          appointmentDate: toDateOnly(a.appointmentDate),
          startTime: a.startTime,
          endTime: a.endTime,
          status: a.status,
          reasonForVisit: a.reasonForVisit,
          medicalRecord: a.medicalRecord
            ? {
                id: a.medicalRecord.id,
                diagnosis: a.medicalRecord.diagnosis,
                treatmentNotes: a.medicalRecord.treatmentNotes,
                recordDate: toDateOnly(a.medicalRecord.recordDate),
                prescriptions: a.medicalRecord.prescriptions.map((p) => ({
                  id: p.id, medicineName: p.medicineName, dosage: p.dosage, frequency: p.frequency, duration: p.duration,
                })),
              }
            : null,
        })),
      },
    }).send(res);
  } catch (err) {
    next(err);
  }
});

export function toPatientProfile(patient) {
  return {
    id: patient.id,
    userId: patient.userId,
    email: patient.user?.email,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: toDateOnly(patient.dateOfBirth),
    gender: patient.gender,
    phone: patient.phone,
    address: patient.address,
    bloodGroup: patient.bloodGroup,
    createdAt: patient.createdAt,
  };
}

export function toPatientUpdateData(body) {
  const data = {};
  for (const key of ['firstName', 'lastName', 'gender', 'phone', 'address', 'bloodGroup']) {
    if (body[key] !== undefined) data[key] = body[key] === '' ? null : body[key];
  }
  if (body.dateOfBirth !== undefined) {
    data.dateOfBirth = body.dateOfBirth ? new Date(`${body.dateOfBirth}T00:00:00.000Z`) : null;
  }
  return data;
}

export default router;
