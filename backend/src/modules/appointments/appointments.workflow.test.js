process.env.NODE_ENV = 'test';

import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../index.js';
import { prisma } from '../../config/database.js';
import { getDayOfWeek } from '../../utils/dateTime.js';

const TEST_EMAILS = {
  patientA: 'workflow.patient.a@medicore.test',
  patientB: 'workflow.patient.b@medicore.test',
  doctorA: 'workflow.doctor.a@medicore.test',
  doctorB: 'workflow.doctor.b@medicore.test',
};

const password = 'Workflow@1234';
let fixture;

beforeAll(async () => {
  fixture = await createFixture();
});

afterAll(async () => {
  await cleanupFixture();
  await prisma.$disconnect();
});

describe('appointment workflow', () => {
  test('requires authentication for doctor listing', async () => {
    const res = await request(app).get('/api/doctors');
    expect(res.status).toBe(401);
  });

  test('lists doctors and exposes department information', async () => {
    const res = await authGet(fixture.patientAToken, '/api/doctors');
    expect(res.status).toBe(200);
    expect(res.body.data.doctors.some((doctor) => doctor.id === fixture.doctorA.id)).toBe(true);
  });

  test('loads doctor profile with department', async () => {
    const res = await authGet(fixture.patientAToken, `/api/doctors/${fixture.doctorA.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.doctor.department.name).toBe(fixture.department.name);
  });

  test('returns available slots from database availability', async () => {
    const res = await authGet(
      fixture.patientAToken,
      `/api/doctors/${fixture.doctorA.id}/availability?date=${fixture.date}`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.slots.some((slot) => slot.startTime === fixture.startTime && slot.isAvailable)).toBe(true);
  });

  test('books an available appointment and shows it to patient and doctor', async () => {
    const booking = await authPost(fixture.patientAToken, '/api/appointments', {
      doctorId: fixture.doctorA.id,
      appointmentDate: fixture.date,
      startTime: fixture.startTime,
      reasonForVisit: 'Workflow integration test booking',
    });

    expect(booking.status).toBe(201);
    fixture.bookedAppointmentId = booking.body.data.appointment.id;

    const patientList = await authGet(fixture.patientAToken, '/api/appointments');
    expect(patientList.body.data.appointments.some((appt) => appt.id === fixture.bookedAppointmentId)).toBe(true);

    const doctorList = await authGet(fixture.doctorAToken, '/api/appointments');
    expect(doctorList.body.data.appointments.some((appt) => appt.id === fixture.bookedAppointmentId)).toBe(true);
  });

  test('rejects duplicate booking for the same doctor slot', async () => {
    const res = await authPost(fixture.patientBToken, '/api/appointments', {
      doctorId: fixture.doctorA.id,
      appointmentDate: fixture.date,
      startTime: fixture.startTime,
      reasonForVisit: 'Duplicate attempt',
    });

    expect(res.status).toBe(409);
  });

  test('prevents concurrent double booking', async () => {
    const [a, b] = await Promise.all([
      authPost(fixture.patientAToken, '/api/appointments', {
        doctorId: fixture.doctorA.id,
        appointmentDate: fixture.concurrentDate,
        startTime: fixture.concurrentStartTime,
      }),
      authPost(fixture.patientBToken, '/api/appointments', {
        doctorId: fixture.doctorA.id,
        appointmentDate: fixture.concurrentDate,
        startTime: fixture.concurrentStartTime,
      }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const count = await prisma.appointment.count({
      where: {
        doctorId: fixture.doctorA.id,
        appointmentDate: new Date(`${fixture.concurrentDate}T00:00:00.000Z`),
        startTime: fixture.concurrentStartTime,
      },
    });
    expect(count).toBe(1);
  });

  test('enforces doctor ownership for status updates', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${fixture.bookedAppointmentId}/status`)
      .set('Authorization', `Bearer ${fixture.doctorBToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(403);
  });

  test('allows a patient to cancel their own future appointment', async () => {
    const res = await authPost(fixture.patientAToken, `/api/appointments/${fixture.bookedAppointmentId}/cancel`, {
      cancellationReason: 'Testing cancellation',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.appointment.status).toBe('CANCELLED_BY_PATIENT');
  });
});

async function authGet(token, path) {
  return request(app).get(path).set('Authorization', `Bearer ${token}`);
}

async function authPost(token, path, body) {
  return request(app).post(path).set('Authorization', `Bearer ${token}`).send(body);
}

async function createFixture() {
  await cleanupFixture();
  const passwordHash = await bcrypt.hash(password, 12);
  const department = await prisma.department.create({
    data: { name: `Workflow Test ${Date.now()}`, description: 'Temporary test department' },
  });

  const patientAUser = await createUser(TEST_EMAILS.patientA, passwordHash, 'PATIENT');
  const patientBUser = await createUser(TEST_EMAILS.patientB, passwordHash, 'PATIENT');
  const doctorAUser = await createUser(TEST_EMAILS.doctorA, passwordHash, 'DOCTOR');
  const doctorBUser = await createUser(TEST_EMAILS.doctorB, passwordHash, 'DOCTOR');

  await prisma.patient.create({ data: { userId: patientAUser.id, firstName: 'Workflow', lastName: 'PatientA' } });
  await prisma.patient.create({ data: { userId: patientBUser.id, firstName: 'Workflow', lastName: 'PatientB' } });
  const doctorA = await prisma.doctor.create({
    data: {
      userId: doctorAUser.id,
      departmentId: department.id,
      firstName: 'Workflow',
      lastName: 'DoctorA',
      specialization: 'Workflow Medicine',
      qualification: 'MBBS',
      slotDurationMinutes: 30,
    },
  });
  await prisma.doctor.create({
    data: {
      userId: doctorBUser.id,
      departmentId: department.id,
      firstName: 'Workflow',
      lastName: 'DoctorB',
      specialization: 'Workflow Medicine',
      qualification: 'MBBS',
      slotDurationMinutes: 30,
    },
  });

  const date = nextDateForDayOffset(4);
  const concurrentDate = nextDateForDayOffset(5);
  await prisma.doctorAvailability.createMany({
    data: [
      { doctorId: doctorA.id, dayOfWeek: getDayOfWeek(date), startTime: '09:00', endTime: '12:00' },
      { doctorId: doctorA.id, dayOfWeek: getDayOfWeek(concurrentDate), startTime: '09:00', endTime: '12:00' },
    ],
  });

  return {
    department,
    doctorA,
    date,
    startTime: '09:00',
    concurrentDate,
    concurrentStartTime: '09:30',
    patientAToken: await login(TEST_EMAILS.patientA),
    patientBToken: await login(TEST_EMAILS.patientB),
    doctorAToken: await login(TEST_EMAILS.doctorA),
    doctorBToken: await login(TEST_EMAILS.doctorB),
  };
}

async function createUser(email, passwordHash, role) {
  return prisma.user.create({ data: { email, passwordHash, role } });
}

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.accessToken;
}

async function cleanupFixture() {
  const users = await prisma.user.findMany({
    where: { email: { in: Object.values(TEST_EMAILS) } },
    include: { patient: true, doctor: true },
  });
  const patientIds = users.map((user) => user.patient?.id).filter(Boolean);
  const doctorIds = users.map((user) => user.doctor?.id).filter(Boolean);

  await prisma.appointment.deleteMany({
    where: { OR: [{ patientId: { in: patientIds } }, { doctorId: { in: doctorIds } }] },
  });
  await prisma.doctorAvailability.deleteMany({ where: { doctorId: { in: doctorIds } } });
  await prisma.doctor.deleteMany({ where: { id: { in: doctorIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  await prisma.user.deleteMany({ where: { email: { in: Object.values(TEST_EMAILS) } } });
  await prisma.department.deleteMany({ where: { name: { startsWith: 'Workflow Test' } } });
}

function nextDateForDayOffset(offset) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}
