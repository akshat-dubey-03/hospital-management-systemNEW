// src/modules/bills/bills.routes.js
// BILL APIs. Demonstration billing records only — no payment gateway.
//
//   PATIENT — read-only, own bills.
//   ADMIN   — list all, create a bill for a completed appointment (explicit
//             amount when the doctor has no consultation fee), update amount
//             and payment status.
//   DOCTOR  — no access.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { validate, validateParams, validateQuery } from '../../middleware/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { requirePatientProfile } from '../../utils/actors.js';
import { toBillResponse, toDateOnly, toMoney } from '../../utils/serialize.js';
import { ensureBillForAppointment } from './bills.service.js';

const router = Router();

const PAYMENT_STATUSES = ['PENDING', 'PAID', 'CANCELLED'];
const amountSchema = z.coerce
  .number({ invalid_type_error: 'Amount must be a number.' })
  .min(0, 'Amount cannot be negative.')
  .max(99999999.99, 'Amount is too large.')
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Amount can have at most two decimal places.');

const billIdSchema = z.object({ id: z.string().uuid('Invalid bill id.') });
const listQuerySchema = z.object({ status: z.enum(PAYMENT_STATUSES).optional() });
const createBillSchema = z.object({
  appointmentId: z.string().uuid('Invalid appointment id.'),
  amount: amountSchema.optional(),
});
const updateBillSchema = z
  .object({
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    amount: amountSchema.optional(),
  })
  .refine((v) => v.paymentStatus !== undefined || v.amount !== undefined, {
    message: 'Provide a payment status or an amount to update.',
  });

const billInclude = {
  appointment: {
    select: {
      id: true, appointmentDate: true, startTime: true, endTime: true, status: true,
      patient: { select: { id: true, firstName: true, lastName: true } },
      doctor: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } },
    },
  },
};

// GET /api/bills — patient: own bills; admin: all (optional ?status=)
router.get('/', authMiddleware, roleGuard('PATIENT', 'ADMIN'), validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.paymentStatus = req.query.status;
    if (req.user.role === 'PATIENT') {
      const patient = await requirePatientProfile(req.user.id);
      where.appointment = { patientId: patient.id };
    }
    const bills = await prisma.bill.findMany({
      where,
      include: billInclude,
      orderBy: [{ billDate: 'desc' }, { createdAt: 'desc' }],
    });
    new ApiResponse(200, { bills: bills.map(toBillWithContext) }).send(res);
  } catch (err) {
    next(err);
  }
});

// GET /api/bills/unbilled — admin: completed appointments that have no bill yet
// (e.g. the doctor had no consultation fee when the visit was completed).
router.get('/unbilled', authMiddleware, roleGuard('ADMIN'), async (_req, res, next) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { status: 'COMPLETED', bill: { is: null } },
      select: {
        ...billInclude.appointment.select,
        doctor: { select: { id: true, firstName: true, lastName: true, consultationFee: true, department: { select: { name: true } } } },
      },
      orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
    });
    new ApiResponse(200, {
      appointments: appointments.map((a) => ({
        ...toAppointmentContext(a),
        suggestedAmount: toMoney(a.doctor?.consultationFee),
      })),
    }).send(res);
  } catch (err) {
    next(err);
  }
});

// GET /api/bills/:id
router.get('/:id', authMiddleware, roleGuard('PATIENT', 'ADMIN'), validateParams(billIdSchema), async (req, res, next) => {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: req.params.id },
      include: { appointment: { select: { ...billInclude.appointment.select, patientId: true } } },
    });
    if (!bill) throw ApiError.notFound('Bill not found.');
    if (req.user.role === 'PATIENT') {
      const patient = await requirePatientProfile(req.user.id);
      if (bill.appointment.patientId !== patient.id) throw ApiError.forbidden('You can only view your own bills.');
    }
    new ApiResponse(200, { bill: toBillWithContext(bill) }).send(res);
  } catch (err) {
    next(err);
  }
});

// POST /api/bills — admin creates the bill for a completed appointment.
// Without "amount" the doctor's consultation fee is used; if there is no fee,
// an amount is required. Never creates a second bill (409).
router.post('/', authMiddleware, roleGuard('ADMIN'), validate(createBillSchema), async (req, res, next) => {
  try {
    const result = await prisma.$transaction((tx) =>
      ensureBillForAppointment(tx, req.body.appointmentId, { amount: req.body.amount })
    );
    if (!result.created && result.bill) {
      throw ApiError.conflict('A bill already exists for this appointment.');
    }
    if (result.reason === 'FEE_MISSING') {
      throw ApiError.unprocessable('This doctor has no consultation fee. Enter the bill amount.', [
        { field: 'amount', message: 'Amount is required because the doctor has no consultation fee.' },
      ]);
    }
    const bill = await prisma.bill.findUnique({ where: { id: result.bill.id }, include: billInclude });
    new ApiResponse(201, { bill: toBillWithContext(bill) }, 'Bill created.').send(res);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/bills/:id — admin updates payment status and/or amount.
// Rules: a CANCELLED bill is final; the amount can only change while PENDING.
router.patch(
  '/:id',
  authMiddleware,
  roleGuard('ADMIN'),
  validateParams(billIdSchema),
  validate(updateBillSchema),
  async (req, res, next) => {
    try {
      const existing = await prisma.bill.findUnique({ where: { id: req.params.id } });
      if (!existing) throw ApiError.notFound('Bill not found.');
      if (existing.paymentStatus === 'CANCELLED') throw ApiError.conflict('Cancelled bills cannot be changed.');

      const nextStatus = req.body.paymentStatus ?? existing.paymentStatus;
      if (req.body.amount !== undefined && existing.paymentStatus !== 'PENDING') {
        throw ApiError.conflict('The amount can only be changed while the bill is pending.');
      }

      const data = { paymentStatus: nextStatus };
      if (req.body.amount !== undefined) data.amount = req.body.amount;
      // Keeps the bills_paid_at_consistent_chk rule: paidAt set exactly when PAID.
      if (nextStatus === 'PAID') data.paidAt = existing.paidAt ?? new Date();
      else data.paidAt = null;

      const bill = await prisma.bill.update({ where: { id: existing.id }, data, include: billInclude });
      new ApiResponse(200, { bill: toBillWithContext(bill) }, 'Bill updated.').send(res);
    } catch (err) {
      next(err);
    }
  }
);

function toAppointmentContext(a) {
  return {
    id: a.id,
    appointmentDate: toDateOnly(a.appointmentDate),
    startTime: a.startTime,
    endTime: a.endTime,
    status: a.status,
    patient: a.patient,
    doctor: a.doctor
      ? { id: a.doctor.id, firstName: a.doctor.firstName, lastName: a.doctor.lastName, department: a.doctor.department?.name ?? null }
      : null,
  };
}

function toBillWithContext(bill) {
  return { ...toBillResponse(bill), appointment: bill.appointment ? toAppointmentContext(bill.appointment) : undefined };
}

export default router;
