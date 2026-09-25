// src/modules/appointments/appointments.routes.js
// Appointment booking and management for patients, doctors, and admins.

import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { validate, validateParams } from '../../middleware/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { generateTimeSlots, getDayOfWeek, isPastDate } from '../../utils/dateTime.js';
import {
  appointmentIdSchema,
  bookAppointmentSchema,
  cancelAppointmentSchema,
  updateAppointmentStatusSchema,
} from './appointments.schemas.js';

const router = Router();

const CANCELLABLE_STATUSES = ['BOOKED', 'CONFIRMED'];

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const where = await appointmentScope(req.user);
    const appointments = await prisma.appointment.findMany({
      where,
      include: appointmentIncludes(req.user.role),
      orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
    });

    new ApiResponse(200, { appointments: appointments.map((appt) => toAppointmentResponse(appt, req.user.role)) }).send(res);
  } catch (err) {
    next(err);
  }
});

router.post('/', authMiddleware, roleGuard('PATIENT'), validate(bookAppointmentSchema), async (req, res, next) => {
  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.findUnique({ where: { userId: req.user.id } });
      if (!patient) throw ApiError.forbidden('Patient profile not found.');

      const doctor = await tx.doctor.findFirst({
        where: { id: req.body.doctorId, isActive: true },
        include: { availability: { where: { isActive: true } } },
      });
      if (!doctor) throw ApiError.notFound('Doctor not found.');

      const slot = resolveRequestedSlot(doctor, req.body.appointmentDate, req.body.startTime);
      if (!slot.isAvailable) throw ApiError.conflict(slot.reason);

      const existingActiveSlot = await tx.appointment.findFirst({
        where: {
          doctorId: doctor.id,
          appointmentDate: new Date(`${req.body.appointmentDate}T00:00:00.000Z`),
          startTime: slot.startTime,
          status: { in: ['BOOKED', 'CONFIRMED', 'COMPLETED'] },
        },
      });
      if (existingActiveSlot) {
        throw ApiError.conflict('This slot is already booked. Please choose another slot.');
      }

      try {
        return await tx.appointment.create({
          data: {
            patientId: patient.id,
            doctorId: doctor.id,
            appointmentDate: new Date(`${req.body.appointmentDate}T00:00:00.000Z`),
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: 'BOOKED',
            reasonForVisit: req.body.reasonForVisit || null,
          },
          include: appointmentIncludes('PATIENT'),
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw ApiError.conflict('This slot has just been booked. Please choose another slot.');
        }
        throw err;
      }
    });

    new ApiResponse(201, { appointment: toAppointmentResponse(appointment, 'PATIENT') }, 'Appointment booked successfully.').send(res);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/cancel',
  authMiddleware,
  roleGuard('PATIENT', 'DOCTOR', 'ADMIN'),
  validateParams(appointmentIdSchema),
  validate(cancelAppointmentSchema),
  async (req, res, next) => {
    try {
      const existing = await getAuthorizedAppointment(req.params.id, req.user);

      if (!CANCELLABLE_STATUSES.includes(existing.status)) {
        throw ApiError.conflict('Only booked or confirmed appointments can be cancelled.');
      }
      if (appointmentHasStarted(existing)) {
        throw ApiError.conflict('Appointments cannot be cancelled after the scheduled start time.');
      }

      const status =
        req.user.role === 'PATIENT'
          ? 'CANCELLED_BY_PATIENT'
          : req.user.role === 'DOCTOR'
            ? 'CANCELLED_BY_DOCTOR'
            : 'CANCELLED_BY_ADMIN';

      const appointment = await prisma.appointment.update({
        where: { id: existing.id },
        data: {
          status,
          cancellationReason: req.body.cancellationReason || null,
          cancelledAt: new Date(),
        },
        include: appointmentIncludes(req.user.role),
      });

      new ApiResponse(200, { appointment: toAppointmentResponse(appointment, req.user.role) }, 'Appointment cancelled successfully.').send(res);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id/status',
  authMiddleware,
  roleGuard('DOCTOR', 'ADMIN'),
  validateParams(appointmentIdSchema),
  validate(updateAppointmentStatusSchema),
  async (req, res, next) => {
    try {
      const existing = await getAuthorizedAppointment(req.params.id, req.user);
      validateStatusTransition(existing.status, req.body.status, req.user.role);

      const appointment = await prisma.appointment.update({
        where: { id: existing.id },
        data: {
          status: req.body.status,
          notes: req.body.notes ?? existing.notes,
          cancellationReason: req.body.status.startsWith('CANCELLED') ? req.body.cancellationReason || null : existing.cancellationReason,
          cancelledAt: req.body.status.startsWith('CANCELLED') ? new Date() : existing.cancelledAt,
        },
        include: appointmentIncludes(req.user.role),
      });

      new ApiResponse(200, { appointment: toAppointmentResponse(appointment, req.user.role) }, 'Appointment status updated.').send(res);
    } catch (err) {
      next(err);
    }
  }
);

async function appointmentScope(user) {
  if (user.role === 'PATIENT') {
    const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
    if (!patient) throw ApiError.forbidden('Patient profile not found.');
    return { patientId: patient.id };
  }

  if (user.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
    if (!doctor) throw ApiError.forbidden('Doctor profile not found.');
    return { doctorId: doctor.id };
  }

  return {};
}

function appointmentIncludes(role) {
  return {
    doctor: { include: { department: true } },
    patient: role === 'DOCTOR' || role === 'ADMIN'
      ? { select: { id: true, firstName: true, lastName: true, phone: true, bloodGroup: true } }
      : { select: { id: true, firstName: true, lastName: true } },
  };
}

async function getAuthorizedAppointment(id, user) {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      doctor: true,
      patient: true,
    },
  });

  if (!appointment) throw ApiError.notFound('Appointment not found.');

  if (user.role === 'PATIENT') {
    const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
    if (!patient || appointment.patientId !== patient.id) throw ApiError.forbidden('You can only manage your own appointments.');
  }

  if (user.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
    if (!doctor || appointment.doctorId !== doctor.id) throw ApiError.forbidden('You can only manage your own appointments.');
  }

  return appointment;
}

function resolveRequestedSlot(doctor, appointmentDate, startTime) {
  if (isPastDate(appointmentDate) || appointmentHasStarted({ appointmentDate, startTime })) {
    return { isAvailable: false, reason: 'Appointments cannot be booked in the past.' };
  }

  const dayOfWeek = getDayOfWeek(appointmentDate);
  const blocks = doctor.availability.filter((block) => block.dayOfWeek === dayOfWeek);
  for (const block of blocks) {
    const slot = generateTimeSlots(block.startTime, block.endTime, doctor.slotDurationMinutes).find(
      (candidate) => candidate.startTime === startTime
    );
    if (slot) return { isAvailable: true, ...slot };
  }

  return { isAvailable: false, reason: 'The selected time is outside this doctor’s availability.' };
}

function appointmentHasStarted(appointment) {
  const date = toDateOnly(appointment.appointmentDate);
  return new Date(`${date}T${appointment.startTime}:00.000Z`) <= new Date();
}

function validateStatusTransition(currentStatus, nextStatus, role) {
  if (currentStatus.startsWith('CANCELLED') || currentStatus === 'COMPLETED') {
    throw ApiError.conflict('Completed or cancelled appointments cannot be changed.');
  }

  if (role === 'DOCTOR' && nextStatus === 'CANCELLED_BY_ADMIN') {
    throw ApiError.forbidden('Doctors cannot use the admin cancellation status.');
  }

  if (nextStatus === 'COMPLETED' && currentStatus !== 'CONFIRMED') {
    throw ApiError.conflict('Only confirmed appointments can be marked completed.');
  }
}

function toAppointmentResponse(appointment, role) {
  return {
    id: appointment.id,
    appointmentDate: toDateOnly(appointment.appointmentDate),
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    status: appointment.status,
    reasonForVisit: appointment.reasonForVisit,
    notes: role === 'PATIENT' ? undefined : appointment.notes,
    cancellationReason: appointment.cancellationReason,
    cancelledAt: appointment.cancelledAt,
    createdAt: appointment.createdAt,
    doctor: appointment.doctor
      ? {
          id: appointment.doctor.id,
          firstName: appointment.doctor.firstName,
          lastName: appointment.doctor.lastName,
          specialization: appointment.doctor.specialization,
          department: appointment.doctor.department,
        }
      : undefined,
    patient: appointment.patient
      ? {
          id: appointment.patient.id,
          firstName: appointment.patient.firstName,
          lastName: appointment.patient.lastName,
          phone: role === 'DOCTOR' || role === 'ADMIN' ? appointment.patient.phone : undefined,
          bloodGroup: role === 'DOCTOR' || role === 'ADMIN' ? appointment.patient.bloodGroup : undefined,
        }
      : undefined,
  };
}

function toDateOnly(value) {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export default router;
