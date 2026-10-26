import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../index.js';
import { prisma } from '../../config/database.js';

const password = 'Dashboard@1234';
const testId = Date.now();

const TEST_USERS = {
  patient: {
    email: `dashboard.patient.${testId}@medicore.test`,
    role: 'PATIENT',
  },
  doctor: {
    email: `dashboard.doctor.${testId}@medicore.test`,
    role: 'DOCTOR',
  },
  admin: {
    email: `dashboard.admin.${testId}@medicore.test`,
    role: 'ADMIN',
  },
};

let fixture;

beforeAll(async () => {
  fixture = await createFixture();
});

afterAll(async () => {
  await cleanupFixture();
  await prisma.$disconnect();
});

describe('dashboard access and aggregation', () => {
  test('patient can retrieve their dashboard data', async () => {
    const res = await authGet(fixture.patientToken, '/api/dashboard/patient');

    expect(res.status).toBe(200);
    expect(res.body.data.patient.email).toBe(TEST_USERS.patient.email);
    expect(res.body.data.upcoming).toBeDefined();
    expect(res.body.data.recent).toBeDefined();
  });

  test('patient cannot retrieve the doctor dashboard', async () => {
    const res = await authGet(fixture.patientToken, '/api/dashboard/doctor');

    expect(res.status).toBe(403);
  });

  test('doctor can retrieve their authorized dashboard data', async () => {
    const res = await authGet(fixture.doctorToken, '/api/dashboard/doctor');

    expect(res.status).toBe(200);
    expect(res.body.data.doctor.email).toBe(TEST_USERS.doctor.email);
    expect(Array.isArray(res.body.data.todaysAppointments)).toBe(true);
  });

  test('doctor cannot access patient dashboard data', async () => {
    const res = await authGet(fixture.doctorToken, '/api/dashboard/patient');

    expect(res.status).toBe(403);
  });

  test('admin can retrieve dashboard statistics', async () => {
    const res = await authGet(fixture.adminToken, '/api/admin/stats');

    expect(res.status).toBe(200);
    expect(res.body.data.totals).toBeDefined();
    expect(res.body.data.recentAppointments).toBeDefined();
  });

  test('non-admin users cannot access admin statistics', async () => {
    const patientRes = await authGet(fixture.patientToken, '/api/admin/stats');
    const doctorRes = await authGet(fixture.doctorToken, '/api/admin/stats');

    expect(patientRes.status).toBe(403);
    expect(doctorRes.status).toBe(403);
  });

  test('admin totals match the database', async () => {
    const res = await authGet(fixture.adminToken, '/api/admin/stats');
    const stats = res.body.data.totals;

    const today = new Date();
    const startOfToday = new Date(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);

    const [patientCount, doctorCount, todayCount, pendingCount, cancelledCount] = await Promise.all([
      prisma.patient.count(),
      prisma.doctor.count({ where: { isActive: true } }),
      prisma.appointment.count({ where: { appointmentDate: { equals: startOfToday } } }),
      prisma.appointment.count({ where: { status: { in: ['BOOKED', 'CONFIRMED'] } } }),
      prisma.appointment.count({ where: { status: { in: ['CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR', 'CANCELLED_BY_ADMIN'] } } }),
    ]);

    expect(stats.totalPatients).toBe(patientCount);
    expect(stats.totalDoctors).toBe(doctorCount);
    expect(stats.todayAppointments).toBe(todayCount);
    expect(stats.pendingAppointments).toBe(pendingCount);
    expect(stats.cancelledAppointments).toBe(cancelledCount);
  });
});

async function authGet(token, path) {
  return request(app).get(path).set('Authorization', `Bearer ${token}`);
}

async function createFixture() {
  await cleanupFixture();

  const patientUser = await prisma.user.create({
    data: {
      email: TEST_USERS.patient.email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'PATIENT',
    },
  });
  const patientProfile = await prisma.patient.create({
    data: {
      userId: patientUser.id,
      firstName: 'Dashboard',
      lastName: 'Patient',
      phone: '9000000000',
      bloodGroup: 'O+',
    },
  });

  const department = await prisma.department.create({
    data: {
      name: `Dashboard Dept ${testId}`,
      description: 'Department for dashboard tests',
    },
  });

  const doctorUser = await prisma.user.create({
    data: {
      email: TEST_USERS.doctor.email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'DOCTOR',
    },
  });
  const doctorProfile = await prisma.doctor.create({
    data: {
      userId: doctorUser.id,
      departmentId: department.id,
      firstName: 'Dashboard',
      lastName: 'Doctor',
      specialization: 'General Medicine',
      qualification: 'MBBS',
      slotDurationMinutes: 30,
    },
  });
  await prisma.doctorAvailability.createMany({
    data: [
      { doctorId: doctorProfile.id, dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
      { doctorId: doctorProfile.id, dayOfWeek: 2, startTime: '09:00', endTime: '12:00', isActive: true },
    ],
  });

  const adminUser = await prisma.user.create({
    data: {
      email: TEST_USERS.admin.email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'ADMIN',
    },
  });

  const today = new Date();
  const todayString = today.toISOString().slice(0, 10);
  const futureDate = new Date(`${todayString}T00:00:00.000Z`);
  futureDate.setUTCDate(futureDate.getUTCDate() + 3);
  const pastDate = new Date(`${todayString}T00:00:00.000Z`);
  pastDate.setUTCDate(pastDate.getUTCDate() - 2);

  const doctorId = doctorProfile.id;
  const patientId = patientProfile.id;

  await prisma.appointment.createMany({
    data: [
      {
        patientId,
        doctorId,
        appointmentDate: futureDate,
        startTime: '09:00',
        endTime: '09:30',
        status: 'BOOKED',
        reasonForVisit: 'Dashboard patient booking',
      },
      {
        patientId,
        doctorId,
        appointmentDate: pastDate,
        startTime: '10:00',
        endTime: '10:30',
        status: 'COMPLETED',
        reasonForVisit: 'Past dashboard booking',
      },
      {
        patientId,
        doctorId,
        appointmentDate: futureDate,
        startTime: '11:00',
        endTime: '11:30',
        status: 'CONFIRMED',
        reasonForVisit: 'Confirmed dashboard booking',
      },
      {
        patientId,
        doctorId,
        appointmentDate: new Date(`${todayString}T00:00:00.000Z`),
        startTime: '12:00',
        endTime: '12:30',
        status: 'CANCELLED_BY_PATIENT',
        reasonForVisit: 'Cancelled dashboard booking',
        cancellationReason: 'Not required',
      },
    ],
  });

  return {
    patientToken: await login(TEST_USERS.patient.email),
    doctorToken: await login(TEST_USERS.doctor.email),
    adminToken: await login(TEST_USERS.admin.email),
  };
}

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password, role: email.includes('patient') ? 'PATIENT' : email.includes('doctor') ? 'DOCTOR' : 'ADMIN' });
  if (res.status !== 200) {
    throw new Error(`Unable to login ${email}: ${res.status} ${res.body?.message || ''}`);
  }
  return res.body.data.accessToken;
}

async function cleanupFixture() {
  const emails = Object.values(TEST_USERS).map((user) => user.email);
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    include: { patient: true, doctor: true },
  });

  const patientIds = users.map((user) => user.patient?.id).filter(Boolean);
  const doctorIds = users.map((user) => user.doctor?.id).filter(Boolean);

  await prisma.appointment.deleteMany({
    where: {
      OR: [{ patientId: { in: patientIds } }, { doctorId: { in: doctorIds } }],
    },
  });
  await prisma.doctorAvailability.deleteMany({ where: { doctorId: { in: doctorIds } } });
  await prisma.doctor.deleteMany({ where: { id: { in: doctorIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  await prisma.department.deleteMany({ where: { name: { startsWith: 'Dashboard Dept' } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}
