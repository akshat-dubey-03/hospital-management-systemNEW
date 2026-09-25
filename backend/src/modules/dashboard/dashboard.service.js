import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';

export async function getPatientDashboard(userId) {
  const patient = await prisma.patient.findUnique({
    where: { userId: userId },
    include: {
      user: { select: { email: true, role: true, isActive: true } },
    },
  });

  if (!patient) throw ApiError.forbidden('Patient profile not found.');

  const appointments = await prisma.appointment.findMany({
    where: { patientId: patient.id },
    include: {
      doctor: { include: { department: true } },
    },
    orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
  });

  const now = new Date();
  const upcoming = appointments.filter((appointment) => !isCancelled(appointment.status) && new Date(`${toDateOnly(appointment.appointmentDate)}T${appointment.startTime}:00.000Z`) >= now);
  const recent = appointments.filter((appointment) => isCancelled(appointment.status) || new Date(`${toDateOnly(appointment.appointmentDate)}T${appointment.startTime}:00.000Z`) < now).slice(-5).reverse();

  return {
    patient: {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.user.email,
      phone: patient.phone,
      bloodGroup: patient.bloodGroup,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
    },
    stats: {
      totalAppointments: appointments.length,
      upcomingCount: upcoming.length,
      recentCount: recent.length,
    },
    upcoming: upcoming.slice(0, 5).map(toAppointmentSummary),
    recent: recent.slice(0, 5).map(toAppointmentSummary),
  };
}

export async function getDoctorDashboard(userId) {
  const doctor = await prisma.doctor.findUnique({
    where: { userId: userId },
    include: {
      department: true,
      user: { select: { email: true, role: true, isActive: true } },
      availability: { where: { isActive: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
    },
  });

  if (!doctor) throw ApiError.forbidden('Doctor profile not found.');

  const appointments = await prisma.appointment.findMany({
    where: { doctorId: doctor.id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      doctor: { include: { department: true } },
    },
    orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
  });

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const todaysAppointments = appointments.filter((appointment) => toDateOnly(appointment.appointmentDate) === todayIso);
  const upcoming = appointments.filter((appointment) => !isCancelled(appointment.status) && new Date(`${toDateOnly(appointment.appointmentDate)}T${appointment.startTime}:00.000Z`) >= today);

  return {
    doctor: {
      id: doctor.id,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      email: doctor.user.email,
      specialization: doctor.specialization,
      qualification: doctor.qualification,
      department: doctor.department,
      consultationFee: doctor.consultationFee,
      slotDurationMinutes: doctor.slotDurationMinutes,
      isActive: doctor.isActive,
    },
    stats: {
      totalAppointments: appointments.length,
      todayCount: todaysAppointments.length,
      upcomingCount: upcoming.length,
      confirmedCount: appointments.filter((appointment) => appointment.status === 'CONFIRMED').length,
    },
    availability: doctor.availability,
    todaysAppointments: todaysAppointments.slice(0, 6).map(toAppointmentSummary),
    upcomingAppointments: upcoming.slice(0, 6).map(toAppointmentSummary),
  };
}

export async function getAdminDashboardStats() {
  const today = new Date();
  const startOfToday = new Date(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);

  const [totalPatients, totalDoctors, totalAppointments, todayAppointments, pendingAppointments, cancelledAppointments, recentAppointments] = await Promise.all([
    prisma.patient.count(),
    prisma.doctor.count({ where: { isActive: true } }),
    prisma.appointment.count(),
    prisma.appointment.count({
      where: {
        appointmentDate: {
          equals: startOfToday,
        },
      },
    }),
    prisma.appointment.count({
      where: {
        status: { in: ['BOOKED', 'CONFIRMED'] },
      },
    }),
    prisma.appointment.count({
      where: {
        status: { in: ['CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR', 'CANCELLED_BY_ADMIN'] },
      },
    }),
    prisma.appointment.findMany({
      include: {
        doctor: { include: { department: true } },
        patient: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
      take: 6,
    }),
  ]);

  return {
    totals: {
      totalPatients,
      totalDoctors,
      totalAppointments,
      todayAppointments,
      pendingAppointments,
      cancelledAppointments,
    },
    recentAppointments: recentAppointments.map((appointment) => ({
      id: appointment.id,
      appointmentDate: toDateOnly(appointment.appointmentDate),
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
      doctor: appointment.doctor ? {
        id: appointment.doctor.id,
        firstName: appointment.doctor.firstName,
        lastName: appointment.doctor.lastName,
        department: appointment.doctor.department,
      } : null,
      patient: appointment.patient ? {
        firstName: appointment.patient.firstName,
        lastName: appointment.patient.lastName,
      } : null,
    })),
  };
}

function toAppointmentSummary(appointment) {
  return {
    id: appointment.id,
    appointmentDate: toDateOnly(appointment.appointmentDate),
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    status: appointment.status,
    reasonForVisit: appointment.reasonForVisit,
    doctor: appointment.doctor
      ? {
          id: appointment.doctor.id,
          firstName: appointment.doctor.firstName,
          lastName: appointment.doctor.lastName,
          specialization: appointment.doctor.specialization,
          department: appointment.doctor.department,
        }
      : null,
    patient: appointment.patient
      ? {
          id: appointment.patient.id,
          firstName: appointment.patient.firstName,
          lastName: appointment.patient.lastName,
        }
      : null,
  };
}

function isCancelled(status) {
  return ['CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR', 'CANCELLED_BY_ADMIN'].includes(status);
}

function toDateOnly(value) {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
