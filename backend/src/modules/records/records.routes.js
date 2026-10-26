// src/modules/records/records.routes.js
// MEDICAL_RECORD and PRESCRIPTION APIs.
//
// Access rules (enforced here, never in the frontend):
//   PATIENT — read-only, own records only.
//   DOCTOR  — create/read/update records for appointments assigned to them;
//             add/remove prescriptions on their own records.
//   ADMIN   — no access to clinical content (403).

import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { validate, validateParams } from '../../middleware/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { requireDoctorProfile, requirePatientProfile } from '../../utils/actors.js';
import { toDateOnly, toMedicalRecordResponse } from '../../utils/serialize.js';
import {
  addPrescriptionsSchema,
  createRecordSchema,
  prescriptionParamsSchema,
  recordIdSchema,
  updateRecordSchema,
} from './records.schemas.js';

const router = Router();

// Statuses in which a doctor may write the clinical record for a visit.
const RECORDABLE_STATUSES = ['CONFIRMED', 'COMPLETED'];

const recordInclude = {
  prescriptions: { orderBy: { createdAt: 'asc' } },
  appointment: {
    select: {
      id: true, appointmentDate: true, startTime: true, endTime: true, status: true, reasonForVisit: true,
      patient: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  doctor: { select: { id: true, firstName: true, lastName: true, specialization: true, department: { select: { name: true } } } },
};

// GET /api/medical-records — patient: own history; doctor: records they wrote.
router.get('/', authMiddleware, roleGuard('PATIENT', 'DOCTOR'), async (req, res, next) => {
  try {
    const where =
      req.user.role === 'PATIENT'
        ? { appointment: { patientId: (await requirePatientProfile(req.user.id)).id } }
        : { doctorId: (await requireDoctorProfile(req.user.id)).id };

    const records = await prisma.medicalRecord.findMany({
      where,
      include: recordInclude,
      orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
    });
    new ApiResponse(200, { records: records.map(toRecordWithContext) }).send(res);
  } catch (err) {
    next(err);
  }
});

// GET /api/medical-records/:id
router.get('/:id', authMiddleware, roleGuard('PATIENT', 'DOCTOR'), validateParams(recordIdSchema), async (req, res, next) => {
  try {
    const record = await getAuthorizedRecord(req.params.id, req.user, { forWrite: false });
    new ApiResponse(200, { record: toRecordWithContext(record) }).send(res);
  } catch (err) {
    next(err);
  }
});

// POST /api/medical-records — doctor creates the record (+ optional prescriptions)
// for one of their own CONFIRMED/COMPLETED appointments. One record per appointment.
router.post('/', authMiddleware, roleGuard('DOCTOR'), validate(createRecordSchema), async (req, res, next) => {
  try {
    const doctor = await requireDoctorProfile(req.user.id);
    const { appointmentId, diagnosis, treatmentNotes, prescriptions } = req.body;

    const record = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { medicalRecord: { select: { id: true } } },
      });
      if (!appointment) throw ApiError.notFound('Appointment not found.');
      if (appointment.doctorId !== doctor.id) {
        throw ApiError.forbidden('You can only write medical records for your own appointments.');
      }
      if (!RECORDABLE_STATUSES.includes(appointment.status)) {
        throw ApiError.conflict('Medical records can only be written for confirmed or completed appointments.');
      }
      if (appointment.medicalRecord) {
        throw ApiError.conflict('This appointment already has a medical record. Edit the existing record instead.');
      }

      return tx.medicalRecord.create({
        data: {
          appointmentId,
          doctorId: doctor.id,
          diagnosis,
          treatmentNotes: treatmentNotes || null,
          prescriptions: { create: prescriptions },
        },
        include: recordInclude,
      });
    });

    new ApiResponse(201, { record: toRecordWithContext(record) }, 'Medical record created.').send(res);
  } catch (err) {
    if (err.code === 'P2002') return next(ApiError.conflict('This appointment already has a medical record.'));
    next(err);
  }
});

// PATCH /api/medical-records/:id — doctor edits diagnosis / treatment notes.
router.patch(
  '/:id',
  authMiddleware,
  roleGuard('DOCTOR'),
  validateParams(recordIdSchema),
  validate(updateRecordSchema),
  async (req, res, next) => {
    try {
      await getAuthorizedRecord(req.params.id, req.user, { forWrite: true });
      const data = {};
      if (req.body.diagnosis !== undefined) data.diagnosis = req.body.diagnosis;
      if (req.body.treatmentNotes !== undefined) data.treatmentNotes = req.body.treatmentNotes || null;

      const record = await prisma.medicalRecord.update({ where: { id: req.params.id }, data, include: recordInclude });
      new ApiResponse(200, { record: toRecordWithContext(record) }, 'Medical record updated.').send(res);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/medical-records/:id/prescriptions — doctor adds one or more lines.
router.post(
  '/:id/prescriptions',
  authMiddleware,
  roleGuard('DOCTOR'),
  validateParams(recordIdSchema),
  validate(addPrescriptionsSchema),
  async (req, res, next) => {
    try {
      await getAuthorizedRecord(req.params.id, req.user, { forWrite: true });
      await prisma.prescription.createMany({
        data: req.body.prescriptions.map((p) => ({ ...p, medicalRecordId: req.params.id })),
      });
      const record = await prisma.medicalRecord.findUnique({ where: { id: req.params.id }, include: recordInclude });
      new ApiResponse(201, { record: toRecordWithContext(record) }, 'Prescription added.').send(res);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/medical-records/:id/prescriptions/:prescriptionId — doctor removes a line.
router.delete(
  '/:id/prescriptions/:prescriptionId',
  authMiddleware,
  roleGuard('DOCTOR'),
  validateParams(prescriptionParamsSchema),
  async (req, res, next) => {
    try {
      await getAuthorizedRecord(req.params.id, req.user, { forWrite: true });
      const { count } = await prisma.prescription.deleteMany({
        where: { id: req.params.prescriptionId, medicalRecordId: req.params.id },
      });
      if (count === 0) throw ApiError.notFound('Prescription not found on this record.');
      new ApiResponse(200, null, 'Prescription removed.').send(res);
    } catch (err) {
      next(err);
    }
  }
);

async function getAuthorizedRecord(id, user, { forWrite }) {
  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: { ...recordInclude, appointment: { select: { ...recordInclude.appointment.select, patientId: true } } },
  });
  if (!record) throw ApiError.notFound('Medical record not found.');

  if (user.role === 'PATIENT') {
    if (forWrite) throw ApiError.forbidden('Patients cannot modify medical records.');
    const patient = await requirePatientProfile(user.id);
    if (record.appointment.patientId !== patient.id) throw ApiError.forbidden('You can only view your own medical records.');
  } else if (user.role === 'DOCTOR') {
    const doctor = await requireDoctorProfile(user.id);
    if (record.doctorId !== doctor.id) throw ApiError.forbidden('You can only access medical records you wrote.');
  } else {
    throw ApiError.forbidden('Access denied.');
  }
  return record;
}

function toRecordWithContext(record) {
  const appt = record.appointment;
  return {
    ...toMedicalRecordResponse(record),
    appointment: appt
      ? {
          id: appt.id,
          appointmentDate: toDateOnly(appt.appointmentDate),
          startTime: appt.startTime,
          endTime: appt.endTime,
          status: appt.status,
          reasonForVisit: appt.reasonForVisit,
          patient: appt.patient,
        }
      : undefined,
    doctor: record.doctor
      ? {
          id: record.doctor.id,
          firstName: record.doctor.firstName,
          lastName: record.doctor.lastName,
          specialization: record.doctor.specialization,
          department: record.doctor.department?.name ?? null,
        }
      : undefined,
  };
}

export default router;
