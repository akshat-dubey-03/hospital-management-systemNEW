import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../index.js';
import { prisma } from '../../config/database.js';

const TEST_USERS = {
  patient: {
    email: 'role.patient@medicore.test',
    password: 'Patient@1234',
    role: 'PATIENT',
  },
  doctor: {
    email: 'role.doctor@medicore.test',
    password: 'Doctor@1234',
    role: 'DOCTOR',
  },
  admin: {
    email: 'role.admin@medicore.test',
    password: 'Admin@1234',
    role: 'ADMIN',
  },
};

describe('role-based login enforcement', () => {
  beforeAll(async () => {
    await cleanup();
    const passwordHash = await bcrypt.hash(TEST_USERS.patient.password, 12);
    await prisma.user.create({
      data: {
        email: TEST_USERS.patient.email,
        passwordHash,
        role: 'PATIENT',
        patient: {
          create: {
            firstName: 'Role',
            lastName: 'Patient',
          },
        },
      },
    });

    await prisma.user.create({
      data: {
        email: TEST_USERS.doctor.email,
        passwordHash: await bcrypt.hash(TEST_USERS.doctor.password, 12),
        role: 'DOCTOR',
        doctor: {
          create: {
            department: {
              create: {
                name: `Role Login Test Dept ${Date.now()}`,
              },
            },
            firstName: 'Role',
            lastName: 'Doctor',
            specialization: 'Internal Medicine',
            qualification: 'MBBS',
            slotDurationMinutes: 30,
          },
        },
      },
    });

    await prisma.user.create({
      data: {
        email: TEST_USERS.admin.email,
        passwordHash: await bcrypt.hash(TEST_USERS.admin.password, 12),
        role: 'ADMIN',
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  test('allows valid patient login on patient flow', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_USERS.patient.email,
      password: TEST_USERS.patient.password,
      role: 'PATIENT',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('PATIENT');
  });

  test('rejects patient login on doctor flow', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_USERS.patient.email,
      password: TEST_USERS.patient.password,
      role: 'DOCTOR',
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/doctors/i);
  });

  test('rejects patient login on admin flow', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_USERS.patient.email,
      password: TEST_USERS.patient.password,
      role: 'ADMIN',
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/administrators/i);
  });

  test('allows valid doctor login on doctor flow', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_USERS.doctor.email,
      password: TEST_USERS.doctor.password,
      role: 'DOCTOR',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('DOCTOR');
  });

  test('rejects doctor login on admin flow', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_USERS.doctor.email,
      password: TEST_USERS.doctor.password,
      role: 'ADMIN',
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/administrators/i);
  });

  test('allows valid admin login on admin flow', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
      role: 'ADMIN',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('ADMIN');
  });

  test('rejects admin login on doctor flow', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
      role: 'DOCTOR',
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/doctors/i);
  });
});

async function cleanup() {
  const emails = Object.values(TEST_USERS).map((user) => user.email);
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, include: { patient: true, doctor: true } });
  const patientIds = users.map((user) => user.patient?.id).filter(Boolean);
  const doctorIds = users.map((user) => user.doctor?.id).filter(Boolean);

  await prisma.appointment.deleteMany({
    where: { OR: [{ patientId: { in: patientIds } }, { doctorId: { in: doctorIds } }] },
  });
  await prisma.doctorAvailability.deleteMany({ where: { doctorId: { in: doctorIds } } });
  await prisma.doctor.deleteMany({ where: { id: { in: doctorIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  await prisma.department.deleteMany({ where: { name: { contains: 'Role Login Test Dept' } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}
