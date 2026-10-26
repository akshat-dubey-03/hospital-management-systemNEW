// src/modules/admin/admin.routes.js
// Administrator APIs: dashboard statistics, doctor and patient management.
// Every route requires an authenticated ADMIN (router-level guard).
// Departments live in /api/departments, bills in /api/bills and appointment
// status changes in /api/appointments — all of which also enforce ADMIN.

import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { validate, validateParams } from '../../middleware/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { toDateOnly, toMoney, toBillResponse } from '../../utils/serialize.js';
import { getAdminDashboardStats } from '../dashboard/dashboard.service.js';
import { hashPassword } from '../auth/auth.service.js';
import { toPatientProfile, toPatientUpdateData } from '../patients/patients.routes.js';
import {
  createDoctorSchema,
  idSchema,
  replaceAvailabilitySchema,
  updateDoctorSchema,
  updatePatientSchema,
} from './admin.schemas.js';

const router = Router();
router.use(authMiddleware, roleGuard('ADMIN'));

// ─── Dashboard ───────────────────────────────────────────────

router.get('/stats', async (_req, res, next) => {
  try {
    const payload = await getAdminDashboardStats();
    new ApiResponse(200, payload, 'Admin dashboard stats loaded.').send(res);
  } catch (err) {
    next(err);
  }
});

// ─── Doctors ─────────────────────────────────────────────────

const doctorInclude = {
  user: { select: { email: true, isActive: true } },
  department: { select: { id: true, name: true } },
  availability: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
  _count: { select: { appointments: true } },
};

// GET /api/admin/doctors — all doctors, including inactive ones
router.get('/doctors', async (_req, res, next) => {
  try {
    const doctors = await prisma.doctor.findMany({ include: doctorInclude, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] });
    new ApiResponse(200, { doctors: doctors.map(toAdminDoctor) }).send(res);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/doctors — creates the login (users) and the doctor profile
// (+ weekly availability) in ONE transaction: either all rows exist or none.
router.post('/doctors', validate(createDoctorSchema), async (req, res, next) => {
  try {
    const { email, password, availability, ...profile } = req.body;
    await assertDepartmentExists(profile.departmentId);
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw ApiError.conflict('An account with this email already exists.');
    }
    const passwordHash = await hashPassword(password);

    const doctor = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, passwordHash, role: 'DOCTOR' } });
      return tx.doctor.create({
        data: {
          ...toDoctorData(profile),
          userId: user.id,
          availability: { create: availability },
        },
        include: doctorInclude,
      });
    });

    new ApiResponse(201, { doctor: toAdminDoctor(doctor) }, 'Doctor account created.').send(res);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/doctors/:id — profile fields and active flag. Deactivating
// also blocks the doctor's login (users.isActive) in the same transaction.
router.patch('/doctors/:id', validateParams(idSchema), validate(updateDoctorSchema), async (req, res, next) => {
  try {
    const existing = await prisma.doctor.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound('Doctor not found.');
    const { isActive, ...profile } = req.body;
    if (profile.departmentId) await assertDepartmentExists(profile.departmentId);

    const doctor = await prisma.$transaction(async (tx) => {
      if (isActive !== undefined) {
        await tx.user.update({ where: { id: existing.userId }, data: { isActive } });
      }
      return tx.doctor.update({
        where: { id: existing.id },
        data: { ...toDoctorData(profile), ...(isActive !== undefined ? { isActive } : {}) },
        include: doctorInclude,
      });
    });

    new ApiResponse(200, { doctor: toAdminDoctor(doctor) }, 'Doctor updated.').send(res);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/doctors/:id/availability — replace the weekly schedule.
// Existing appointments are not touched (slots are generated, not stored).
router.put('/doctors/:id/availability', validateParams(idSchema), validate(replaceAvailabilitySchema), async (req, res, next) => {
  try {
    const existing = await prisma.doctor.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw ApiError.notFound('Doctor not found.');

    const doctor = await prisma.$transaction(async (tx) => {
      await tx.doctorAvailability.deleteMany({ where: { doctorId: existing.id } });
      if (req.body.availability.length) {
        await tx.doctorAvailability.createMany({
          data: req.body.availability.map((b) => ({ ...b, doctorId: existing.id })),
        });
      }
      return tx.doctor.findUnique({ where: { id: existing.id }, include: doctorInclude });
    });

    new ApiResponse(200, { doctor: toAdminDoctor(doctor) }, 'Availability updated.').send(res);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/doctors/:id — only for doctors with no appointment history;
// otherwise deactivate (history must be kept: appointments/records RESTRICT).
router.delete('/doctors/:id', validateParams(idSchema), async (req, res, next) => {
  try {
    const doctor = await prisma.doctor.findUnique({ where: { id: req.params.id }, include: { _count: { select: { appointments: true, medicalRecords: true } } } });
    if (!doctor) throw ApiError.notFound('Doctor not found.');
    if (doctor._count.appointments > 0 || doctor._count.medicalRecords > 0) {
      throw ApiError.conflict('This doctor has appointment history and cannot be deleted. Deactivate the doctor instead.');
    }
    // users → doctors → doctor_availability cascade.
    await prisma.user.delete({ where: { id: doctor.userId } });
    new ApiResponse(200, null, 'Doctor deleted.').send(res);
  } catch (err) {
    next(err);
  }
});

// ─── Patients ────────────────────────────────────────────────

// GET /api/admin/patients?search=
router.get('/patients', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const patients = await prisma.patient.findMany({
      where: search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {},
      include: { user: { select: { email: true, isActive: true, createdAt: true } }, _count: { select: { appointments: true } } },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    new ApiResponse(200, {
      patients: patients.map((p) => ({ ...toPatientProfile(p), isActive: p.user.isActive, appointmentCount: p._count.appointments })),
    }).send(res);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/patients/:id — profile, appointment history and bills.
// Clinical records (diagnosis/prescriptions) are deliberately not included.
router.get('/patients/:id', validateParams(idSchema), async (req, res, next) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { email: true, isActive: true, createdAt: true } },
        appointments: {
          include: { doctor: { select: { firstName: true, lastName: true, department: { select: { name: true } } } }, bill: true },
          orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
        },
      },
    });
    if (!patient) throw ApiError.notFound('Patient not found.');
    new ApiResponse(200, {
      patient: {
        ...toPatientProfile(patient),
        isActive: patient.user.isActive,
        appointments: patient.appointments.map((a) => ({
          id: a.id,
          appointmentDate: toDateOnly(a.appointmentDate),
          startTime: a.startTime,
          endTime: a.endTime,
          status: a.status,
          doctor: { firstName: a.doctor.firstName, lastName: a.doctor.lastName, department: a.doctor.department?.name },
          bill: toBillResponse(a.bill),
        })),
      },
    }).send(res);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/patients/:id — profile fields and/or account active flag
router.patch('/patients/:id', validateParams(idSchema), validate(updatePatientSchema), async (req, res, next) => {
  try {
    const existing = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound('Patient not found.');
    const { isActive, ...profile } = req.body;

    const patient = await prisma.$transaction(async (tx) => {
      if (isActive !== undefined) await tx.user.update({ where: { id: existing.userId }, data: { isActive } });
      return tx.patient.update({
        where: { id: existing.id },
        data: toPatientUpdateData(profile),
        include: { user: { select: { email: true, isActive: true, createdAt: true } } },
      });
    });
    new ApiResponse(200, { patient: { ...toPatientProfile(patient), isActive: patient.user.isActive } }, 'Patient updated.').send(res);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/patients/:id — only when the patient has no appointment,
// feedback or query history (FKs are RESTRICT). Otherwise deactivate.
router.delete('/patients/:id', validateParams(idSchema), async (req, res, next) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { appointments: true, feedback: true, queries: true } } },
    });
    if (!patient) throw ApiError.notFound('Patient not found.');
    const { appointments, feedback, queries } = patient._count;
    if (appointments + feedback + queries > 0) {
      throw ApiError.conflict('This patient has appointment or support history and cannot be deleted. Deactivate the account instead.');
    }
    await prisma.user.delete({ where: { id: patient.userId } });
    new ApiResponse(200, null, 'Patient deleted.').send(res);
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ─────────────────────────────────────────────────

async function assertDepartmentExists(id) {
  const department = await prisma.department.findUnique({ where: { id }, select: { id: true } });
  if (!department) throw ApiError.badRequest('Validation failed.', [{ field: 'departmentId', message: 'Department not found.' }]);
}

function toDoctorData(profile) {
  const data = {};
  for (const key of ['departmentId', 'firstName', 'lastName', 'specialization', 'qualification', 'experienceYears', 'bio', 'consultationFee', 'slotDurationMinutes']) {
    if (profile[key] !== undefined) data[key] = profile[key];
  }
  if (profile.phone !== undefined) data.phone = profile.phone || null;
  if (data.bio === '') data.bio = null;
  return data;
}

function toAdminDoctor(d) {
  return {
    id: d.id,
    userId: d.userId,
    email: d.user?.email,
    accountActive: d.user?.isActive,
    isActive: d.isActive,
    firstName: d.firstName,
    lastName: d.lastName,
    specialization: d.specialization,
    qualification: d.qualification,
    experienceYears: d.experienceYears,
    bio: d.bio,
    phone: d.phone,
    consultationFee: toMoney(d.consultationFee),
    slotDurationMinutes: d.slotDurationMinutes,
    department: d.department,
    availability: (d.availability || []).map((b) => ({ id: b.id, dayOfWeek: b.dayOfWeek, startTime: b.startTime, endTime: b.endTime, isActive: b.isActive })),
    appointmentCount: d._count?.appointments ?? 0,
  };
}

export default router;
