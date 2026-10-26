// src/modules/doctors/doctors.routes.js
// Doctor discovery and availability APIs for the appointment workflow.

import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { validateParams, validateQuery } from '../../middleware/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { generateTimeSlots, getDayOfWeek, isPastDate } from '../../utils/dateTime.js';
import { availabilityQuerySchema, doctorIdSchema } from './doctors.schemas.js';

const router = Router();

const ACTIVE_STATUSES = ['BOOKED', 'CONFIRMED', 'COMPLETED'];

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;

    const doctors = await prisma.doctor.findMany({
      where: {
        isActive: true,
        ...(departmentId ? { departmentId } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { specialization: { contains: search, mode: 'insensitive' } },
                { department: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        department: true,
        availability: { where: { isActive: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    new ApiResponse(200, { doctors: doctors.map(toDoctorListItem) }).send(res);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authMiddleware, validateParams(doctorIdSchema), async (req, res, next) => {
  try {
    const doctor = await prisma.doctor.findFirst({
      where: { id: req.params.id, isActive: true },
      include: {
        department: true,
        availability: { where: { isActive: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      },
    });

    if (!doctor) throw ApiError.notFound('Doctor not found.');

    new ApiResponse(200, { doctor: toDoctorProfile(doctor) }).send(res);
  } catch (err) {
    next(err);
  }
});

router.get(
  '/:id/availability',
  authMiddleware,
  roleGuard('PATIENT', 'DOCTOR', 'ADMIN'),
  validateParams(doctorIdSchema),
  validateQuery(availabilityQuerySchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { date } = req.query;
      const doctor = await prisma.doctor.findFirst({
        where: { id, isActive: true },
        include: { department: true, availability: { where: { isActive: true } } },
      });

      if (!doctor) throw ApiError.notFound('Doctor not found.');

      const dayOfWeek = getDayOfWeek(date);
      const blocks = doctor.availability.filter((block) => block.dayOfWeek === dayOfWeek);
      const activeAppointments = await prisma.appointment.findMany({
        where: {
          doctorId: id,
          appointmentDate: new Date(`${date}T00:00:00.000Z`),
          status: { in: ACTIVE_STATUSES },
        },
        select: { startTime: true, endTime: true, status: true },
      });

      const bookedByStart = new Map(activeAppointments.map((appt) => [appt.startTime, appt]));
      const slots = blocks.flatMap((block) =>
        generateTimeSlots(block.startTime, block.endTime, doctor.slotDurationMinutes).map((slot) => {
          const booked = bookedByStart.get(slot.startTime);
          const past = isPastDate(date) || isPastSlot(date, slot.startTime);
          return {
            ...slot,
            isAvailable: !booked && !past,
            status: booked ? 'BOOKED' : past ? 'PAST' : 'AVAILABLE',
          };
        })
      );

      new ApiResponse(200, {
        doctor: {
          id: doctor.id,
          firstName: doctor.firstName,
          lastName: doctor.lastName,
          specialization: doctor.specialization,
          department: doctor.department,
          slotDurationMinutes: doctor.slotDurationMinutes,
        },
        date,
        dayOfWeek,
        slots,
      }).send(res);
    } catch (err) {
      next(err);
    }
  }
);

function toDoctorListItem(doctor) {
  return {
    id: doctor.id,
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    specialization: doctor.specialization,
    qualification: doctor.qualification,
    experienceYears: doctor.experienceYears,
    consultationFee: doctor.consultationFee,
    slotDurationMinutes: doctor.slotDurationMinutes,
    department: doctor.department,
    availability: doctor.availability,
  };
}

function toDoctorProfile(doctor) {
  return {
    ...toDoctorListItem(doctor),
    bio: doctor.bio,
    phone: doctor.phone,
  };
}

function isPastSlot(date, startTime) {
  return new Date(`${date}T${startTime}:00.000Z`) <= new Date();
}

export default router;
