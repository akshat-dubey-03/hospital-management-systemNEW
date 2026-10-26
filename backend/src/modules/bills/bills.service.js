// src/modules/bills/bills.service.js
// Bill generation shared by the appointment workflow and the admin API.

import { Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Creates the bill for a COMPLETED appointment from the doctor's consultation
 * fee. Idempotent: if a bill already exists it is returned unchanged, so a
 * repeated request can never create a second bill (bills."appointmentId" is
 * also UNIQUE in the database).
 *
 * @param {Prisma.TransactionClient} tx
 * @param {string} appointmentId
 * @param {{ amount?: number }} [options] explicit amount (admin) overrides the fee
 * @returns {Promise<{ bill: object|null, created: boolean, reason?: string }>}
 */
export async function ensureBillForAppointment(tx, appointmentId, options = {}) {
  const appointment = await tx.appointment.findUnique({
    where: { id: appointmentId },
    include: { doctor: { select: { consultationFee: true } }, bill: true },
  });
  if (!appointment) throw ApiError.notFound('Appointment not found.');

  if (appointment.bill) return { bill: appointment.bill, created: false };

  if (appointment.status !== 'COMPLETED') {
    throw ApiError.conflict('Bills can only be generated for completed appointments.');
  }

  const amount = options.amount ?? appointment.doctor?.consultationFee;
  if (amount === null || amount === undefined) {
    return { bill: null, created: false, reason: 'FEE_MISSING' };
  }

  try {
    const bill = await tx.bill.create({
      data: { appointmentId, amount, paymentStatus: 'PENDING' },
    });
    return { bill, created: true };
  } catch (err) {
    // A concurrent request created it first. The failed INSERT has aborted
    // this PostgreSQL transaction, so report the conflict instead of retrying.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw ApiError.conflict('A bill already exists for this appointment.');
    }
    throw err;
  }
}
