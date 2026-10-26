// Integration tests for the final-review workflows: medical records,
// prescriptions, billing, admin management and access control.
// Runs against TEST_DATABASE_URL (see test/setupTestDatabase.js).

import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../index.js';
import { prisma } from '../../config/database.js';
import { getDayOfWeek } from '../../utils/dateTime.js';

const PREFIX = 'mbflow';
const EMAILS = {
  patientA: `${PREFIX}.patient.a@medicore.test`,
  patientB: `${PREFIX}.patient.b@medicore.test`,
  doctorA: `${PREFIX}.doctor.a@medicore.test`, // has a consultation fee
  doctorB: `${PREFIX}.doctor.b@medicore.test`, // no fee
  admin: `${PREFIX}.admin@medicore.test`,
  newDoctor: `${PREFIX}.created.doctor@medicore.test`,
};
const DEPT_PREFIX = 'MBFlow Test';
const password = 'Flow@12345';

let fx;

beforeAll(async () => {
  fx = await createFixture();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

const get = (token, path) => request(app).get(path).set('Authorization', `Bearer ${token}`);
const post = (token, path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body);
const patch = (token, path, body) => request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body);
const put = (token, path, body) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body);
const del = (token, path) => request(app).delete(path).set('Authorization', `Bearer ${token}`);

describe('health', () => {
  test('reports server and database status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });
});

describe('access control on new endpoints', () => {
  test.each([
    ['get', '/api/medical-records'],
    ['get', '/api/bills'],
    ['get', '/api/departments'],
    ['get', '/api/patients/me'],
    ['get', '/api/admin/doctors'],
    ['get', '/api/admin/patients'],
  ])('%s %s without a token is 401', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });

  test('non-admins cannot use admin management APIs', async () => {
    expect((await get(fx.patientAToken, '/api/admin/doctors')).status).toBe(403);
    expect((await get(fx.doctorAToken, '/api/admin/patients')).status).toBe(403);
    expect((await post(fx.patientAToken, '/api/departments', { name: `${DEPT_PREFIX} nope` })).status).toBe(403);
    expect((await get(fx.doctorAToken, '/api/bills')).status).toBe(403);
  });

  test('admins cannot read clinical records', async () => {
    expect((await get(fx.adminToken, '/api/medical-records')).status).toBe(403);
  });
});

describe('appointment completion, medical records and prescriptions', () => {
  test('patient books, doctor confirms', async () => {
    fx.apptA = await bookAndConfirm(fx.patientAToken, fx.doctorAToken, fx.doctorA.id, fx.dateA, '09:00');
    expect(fx.apptA.status).toBe('CONFIRMED');
  });

  test('a doctor cannot write a record for another doctor\'s appointment', async () => {
    const res = await post(fx.doctorBToken, '/api/medical-records', { appointmentId: fx.apptA.id, diagnosis: 'Not mine' });
    expect(res.status).toBe(403);
    expect(await prisma.medicalRecord.count({ where: { appointmentId: fx.apptA.id } })).toBe(0);
  });

  test('a record cannot be written for a BOOKED appointment', async () => {
    const booked = await post(fx.patientBToken, '/api/appointments', { doctorId: fx.doctorA.id, appointmentDate: fx.dateA, startTime: '10:00' });
    expect(booked.status).toBe(201);
    fx.bookedOnly = booked.body.data.appointment;
    const res = await post(fx.doctorAToken, '/api/medical-records', { appointmentId: fx.bookedOnly.id, diagnosis: 'Too early' });
    expect(res.status).toBe(409);
  });

  test('validation rejects a blank diagnosis and incomplete prescriptions', async () => {
    const res = await post(fx.doctorAToken, '/api/medical-records', {
      appointmentId: fx.apptA.id, diagnosis: '   ', prescriptions: [{ medicineName: 'X', dosage: '', frequency: 'd', duration: '1' }],
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['diagnosis', 'prescriptions.0.dosage']));
  });

  test('the assigned doctor creates a record with two prescriptions', async () => {
    const res = await post(fx.doctorAToken, '/api/medical-records', {
      appointmentId: fx.apptA.id,
      diagnosis: 'Acute gastritis',
      treatmentNotes: 'Bland diet for one week.',
      prescriptions: [
        { medicineName: 'Pantoprazole', dosage: '40 mg', frequency: 'Once daily before breakfast', duration: '14 days' },
        { medicineName: 'Antacid syrup', dosage: '10 ml', frequency: 'After meals', duration: '7 days' },
      ],
    });
    expect(res.status).toBe(201);
    fx.recordA = res.body.data.record;
    expect(fx.recordA.prescriptions).toHaveLength(2);
    expect(fx.recordA.doctorId).toBe(fx.doctorA.id);
  });

  test('a second record for the same appointment is rejected', async () => {
    const res = await post(fx.doctorAToken, '/api/medical-records', { appointmentId: fx.apptA.id, diagnosis: 'Again' });
    expect(res.status).toBe(409);
    expect(await prisma.medicalRecord.count({ where: { appointmentId: fx.apptA.id } })).toBe(1);
  });

  test('the doctor adds and removes a prescription and edits the record', async () => {
    const added = await post(fx.doctorAToken, `/api/medical-records/${fx.recordA.id}/prescriptions`, {
      prescriptions: [{ medicineName: 'ORS', dosage: '1 sachet', frequency: 'As needed', duration: '3 days' }],
    });
    expect(added.status).toBe(201);
    expect(added.body.data.record.prescriptions).toHaveLength(3);

    const ors = added.body.data.record.prescriptions.find((p) => p.medicineName === 'ORS');
    expect((await del(fx.doctorAToken, `/api/medical-records/${fx.recordA.id}/prescriptions/${ors.id}`)).status).toBe(200);

    const edited = await patch(fx.doctorAToken, `/api/medical-records/${fx.recordA.id}`, { treatmentNotes: 'Bland diet for two weeks.' });
    expect(edited.status).toBe(200);
    expect(edited.body.data.record.treatmentNotes).toBe('Bland diet for two weeks.');
    expect(edited.body.data.record.prescriptions).toHaveLength(2);
  });

  test('another doctor cannot edit or add prescriptions to the record', async () => {
    expect((await patch(fx.doctorBToken, `/api/medical-records/${fx.recordA.id}`, { diagnosis: 'Hijack' })).status).toBe(403);
    expect((await post(fx.doctorBToken, `/api/medical-records/${fx.recordA.id}/prescriptions`, {
      prescriptions: [{ medicineName: 'X', dosage: '1', frequency: '1', duration: '1' }],
    })).status).toBe(403);
  });

  test('completing generates exactly one bill from the consultation fee', async () => {
    const res = await patch(fx.doctorAToken, `/api/appointments/${fx.apptA.id}/status`, { status: 'COMPLETED' });
    expect(res.status).toBe(200);
    expect(res.body.data.billGenerated).toBe(true);

    const again = await patch(fx.doctorAToken, `/api/appointments/${fx.apptA.id}/status`, { status: 'COMPLETED' });
    expect(again.status).toBe(409);

    const bills = await prisma.bill.findMany({ where: { appointmentId: fx.apptA.id } });
    expect(bills).toHaveLength(1);
    expect(Number(bills[0].amount)).toBe(650);
    expect(bills[0].paymentStatus).toBe('PENDING');
    fx.billA = bills[0];
  });

  test('the patient sees their own record, prescriptions and bill', async () => {
    const records = await get(fx.patientAToken, '/api/medical-records');
    expect(records.status).toBe(200);
    const mine = records.body.data.records.find((r) => r.id === fx.recordA.id);
    expect(mine.diagnosis).toBe('Acute gastritis');
    expect(mine.prescriptions).toHaveLength(2);

    const bills = await get(fx.patientAToken, '/api/bills');
    expect(bills.body.data.bills.map((b) => b.id)).toContain(fx.billA.id);

    const detail = await get(fx.patientAToken, `/api/appointments/${fx.apptA.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.appointment.medicalRecord.id).toBe(fx.recordA.id);
    expect(detail.body.data.appointment.bill.amount).toBe(650);
  });

  test('another patient cannot see that record, bill or appointment', async () => {
    expect((await get(fx.patientBToken, `/api/medical-records/${fx.recordA.id}`)).status).toBe(403);
    expect((await get(fx.patientBToken, `/api/bills/${fx.billA.id}`)).status).toBe(403);
    expect((await get(fx.patientBToken, `/api/appointments/${fx.apptA.id}`)).status).toBe(403);
    const list = await get(fx.patientBToken, '/api/medical-records');
    expect(list.body.data.records.some((r) => r.id === fx.recordA.id)).toBe(false);
  });

  test('admin appointment detail omits the clinical record', async () => {
    const res = await get(fx.adminToken, `/api/appointments/${fx.apptA.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.appointment.medicalRecord).toBeUndefined();
    expect(res.body.data.appointment.bill.id).toBe(fx.billA.id);
  });
});

describe('billing administration', () => {
  test('admin marks the bill paid; paidAt is recorded', async () => {
    const res = await patch(fx.adminToken, `/api/bills/${fx.billA.id}`, { paymentStatus: 'PAID' });
    expect(res.status).toBe(200);
    expect(res.body.data.bill.paymentStatus).toBe('PAID');
    expect(res.body.data.bill.paidAt).toBeTruthy();
  });

  test('amount cannot change once paid; patients cannot update bills', async () => {
    expect((await patch(fx.adminToken, `/api/bills/${fx.billA.id}`, { amount: 1 })).status).toBe(409);
    expect((await patch(fx.patientAToken, `/api/bills/${fx.billA.id}`, { paymentStatus: 'PENDING' })).status).toBe(403);
    expect((await patch(fx.adminToken, `/api/bills/${fx.billA.id}`, { paymentStatus: 'REFUNDED' })).status).toBe(400);
  });

  test('without a consultation fee, completion leaves the bill to the admin', async () => {
    const appt = await bookAndConfirm(fx.patientBToken, fx.doctorBToken, fx.doctorB.id, fx.dateB, '09:00');
    const done = await patch(fx.doctorBToken, `/api/appointments/${appt.id}/status`, { status: 'COMPLETED' });
    expect(done.status).toBe(200);
    expect(done.body.data.billGenerated).toBe(false);
    expect(done.body.data.billPendingAmount).toBe(true);
    expect(await prisma.bill.count({ where: { appointmentId: appt.id } })).toBe(0);

    const unbilled = await get(fx.adminToken, '/api/bills/unbilled');
    expect(unbilled.body.data.appointments.map((a) => a.id)).toContain(appt.id);

    const noAmount = await post(fx.adminToken, '/api/bills', { appointmentId: appt.id });
    expect(noAmount.status).toBe(422);
    expect((await post(fx.adminToken, '/api/bills', { appointmentId: appt.id, amount: -5 })).status).toBe(400);

    const created = await post(fx.adminToken, '/api/bills', { appointmentId: appt.id, amount: 425.5 });
    expect(created.status).toBe(201);
    expect(created.body.data.bill.amount).toBe(425.5);

    expect((await post(fx.adminToken, '/api/bills', { appointmentId: appt.id, amount: 1 })).status).toBe(409);
    expect(await prisma.bill.count({ where: { appointmentId: appt.id } })).toBe(1);
  });

  test('bills cannot be created for appointments that are not completed', async () => {
    const res = await post(fx.adminToken, '/api/bills', { appointmentId: fx.bookedOnly.id, amount: 100 });
    expect(res.status).toBe(409);
  });
});

describe('admin management', () => {
  test('department create, duplicate, and protected delete', async () => {
    const created = await post(fx.adminToken, '/api/departments', { name: `${DEPT_PREFIX} Radiology`, description: 'Imaging' });
    expect(created.status).toBe(201);
    expect((await post(fx.adminToken, '/api/departments', { name: `${DEPT_PREFIX} radiology` })).status).toBe(409);

    // Department with doctors cannot be deleted.
    expect((await del(fx.adminToken, `/api/departments/${fx.department.id}`)).status).toBe(409);

    const renamed = await patch(fx.adminToken, `/api/departments/${created.body.data.department.id}`, { name: `${DEPT_PREFIX} Imaging` });
    expect(renamed.status).toBe(200);
    expect((await del(fx.adminToken, `/api/departments/${created.body.data.department.id}`)).status).toBe(200);
  });

  test('creating a doctor creates login + profile + availability atomically', async () => {
    const body = {
      email: EMAILS.newDoctor, password: 'Doctor@9876', departmentId: fx.department.id,
      firstName: 'Created', lastName: 'Doctor', specialization: 'General', qualification: 'MBBS',
      consultationFee: 300, slotDurationMinutes: 30,
      availability: [{ dayOfWeek: 0, startTime: '09:00', endTime: '12:00' }],
    };
    const res = await post(fx.adminToken, '/api/admin/doctors', body);
    expect(res.status).toBe(201);
    fx.createdDoctor = res.body.data.doctor;
    expect(fx.createdDoctor.availability).toHaveLength(1);

    const login = await request(app).post('/api/auth/login').send({ email: EMAILS.newDoctor, password: 'Doctor@9876', role: 'DOCTOR' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.doctorId).toBe(fx.createdDoctor.id);

    // Duplicate email: rejected, and no orphan user/doctor is created.
    const dup = await post(fx.adminToken, '/api/admin/doctors', body);
    expect(dup.status).toBe(409);
    expect(await prisma.user.count({ where: { email: EMAILS.newDoctor } })).toBe(1);
  });

  test('overlapping availability is rejected; valid schedule replaces the old one', async () => {
    const bad = await put(fx.adminToken, `/api/admin/doctors/${fx.createdDoctor.id}/availability`, {
      availability: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }, { dayOfWeek: 1, startTime: '11:00', endTime: '13:00' }],
    });
    expect(bad.status).toBe(400);
    const ok = await put(fx.adminToken, `/api/admin/doctors/${fx.createdDoctor.id}/availability`, {
      availability: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }, { dayOfWeek: 3, startTime: '14:00', endTime: '16:00' }],
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.doctor.availability.map((b) => b.dayOfWeek)).toEqual([1, 3]);
  });

  test('doctor deactivation hides the doctor and blocks login; delete rules hold', async () => {
    const off = await patch(fx.adminToken, `/api/admin/doctors/${fx.createdDoctor.id}`, { isActive: false });
    expect(off.status).toBe(200);
    const listed = await get(fx.patientAToken, '/api/doctors');
    expect(listed.body.data.doctors.some((d) => d.id === fx.createdDoctor.id)).toBe(false);
    const login = await request(app).post('/api/auth/login').send({ email: EMAILS.newDoctor, password: 'Doctor@9876' });
    expect(login.status).toBe(401);

    // Doctor with appointment history cannot be deleted; one without can.
    expect((await del(fx.adminToken, `/api/admin/doctors/${fx.doctorA.id}`)).status).toBe(409);
    expect((await del(fx.adminToken, `/api/admin/doctors/${fx.createdDoctor.id}`)).status).toBe(200);
    expect(await prisma.user.count({ where: { email: EMAILS.newDoctor } })).toBe(0);
  });

  test('admin lists, views and deactivates patients; history blocks deletion', async () => {
    const list = await get(fx.adminToken, `/api/admin/patients?search=${PREFIX}`);
    expect(list.status).toBe(200);
    expect(list.body.data.patients.map((p) => p.email)).toEqual(expect.arrayContaining([EMAILS.patientA, EMAILS.patientB]));

    const detail = await get(fx.adminToken, `/api/admin/patients/${fx.patientA.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.patient.appointments.length).toBeGreaterThan(0);

    expect((await del(fx.adminToken, `/api/admin/patients/${fx.patientA.id}`)).status).toBe(409);

    const off = await patch(fx.adminToken, `/api/admin/patients/${fx.patientB.id}`, { isActive: false, phone: '9000000000' });
    expect(off.status).toBe(200);
    expect(off.body.data.patient.isActive).toBe(false);
    const login = await request(app).post('/api/auth/login').send({ email: EMAILS.patientB, password });
    expect(login.status).toBe(401);
    await patch(fx.adminToken, `/api/admin/patients/${fx.patientB.id}`, { isActive: true });
  });

  test('admin dashboard totals include billing figures', async () => {
    const res = await get(fx.adminToken, '/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.totals).toEqual(expect.objectContaining({ totalDepartments: expect.any(Number), paidBills: expect.any(Number), pendingBills: expect.any(Number) }));
  });
});

describe('patient profile and doctor patient view', () => {
  test('patient reads and updates their profile with validation', async () => {
    const me = await get(fx.patientAToken, '/api/patients/me');
    expect(me.status).toBe(200);
    expect(me.body.data.patient.email).toBe(EMAILS.patientA);

    expect((await patch(fx.patientAToken, '/api/patients/me', { bloodGroup: 'Z+' })).status).toBe(400);
    expect((await patch(fx.patientAToken, '/api/patients/me', { role: 'ADMIN' })).status).toBe(400);

    const upd = await patch(fx.patientAToken, '/api/patients/me', { phone: '9876500000', bloodGroup: 'B+', dateOfBirth: '1999-04-01', gender: 'FEMALE' });
    expect(upd.status).toBe(200);
    expect(upd.body.data.patient).toMatchObject({ phone: '9876500000', bloodGroup: 'B+', dateOfBirth: '1999-04-01', gender: 'FEMALE' });
  });

  test('doctor sees only their own patients', async () => {
    const list = await get(fx.doctorAToken, '/api/patients');
    expect(list.status).toBe(200);
    expect(list.body.data.patients.map((p) => p.id)).toContain(fx.patientA.id);

    const detail = await get(fx.doctorAToken, `/api/patients/${fx.patientA.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.patient.appointments.some((a) => a.medicalRecord?.id === fx.recordA.id)).toBe(true);

    // Doctor B has never seen patient A.
    expect((await get(fx.doctorBToken, `/api/patients/${fx.patientA.id}`)).status).toBe(404);
    expect((await get(fx.patientAToken, '/api/patients')).status).toBe(403);
  });
});

// ─── fixture helpers ─────────────────────────────────────────

async function bookAndConfirm(patientToken, doctorToken, doctorId, date, startTime) {
  const booked = await post(patientToken, '/api/appointments', { doctorId, appointmentDate: date, startTime, reasonForVisit: 'Flow test' });
  expect(booked.status).toBe(201);
  const confirmed = await patch(doctorToken, `/api/appointments/${booked.body.data.appointment.id}/status`, { status: 'CONFIRMED' });
  expect(confirmed.status).toBe(200);
  return confirmed.body.data.appointment;
}

async function createFixture() {
  await cleanup();
  const passwordHash = await bcrypt.hash(password, 4);
  const department = await prisma.department.create({ data: { name: `${DEPT_PREFIX} ${Date.now()}` } });

  const mkUser = (email, role) => prisma.user.create({ data: { email, passwordHash, role } });
  const [pa, pb, da, db, admin] = await Promise.all([
    mkUser(EMAILS.patientA, 'PATIENT'), mkUser(EMAILS.patientB, 'PATIENT'),
    mkUser(EMAILS.doctorA, 'DOCTOR'), mkUser(EMAILS.doctorB, 'DOCTOR'), mkUser(EMAILS.admin, 'ADMIN'),
  ]);
  const patientA = await prisma.patient.create({ data: { userId: pa.id, firstName: 'Flow', lastName: 'PatientA' } });
  const patientB = await prisma.patient.create({ data: { userId: pb.id, firstName: 'Flow', lastName: 'PatientB' } });
  const doctorA = await prisma.doctor.create({
    data: { userId: da.id, departmentId: department.id, firstName: 'Flow', lastName: 'DoctorA', specialization: 'Gastro', qualification: 'MBBS', consultationFee: 650 },
  });
  const doctorB = await prisma.doctor.create({
    data: { userId: db.id, departmentId: department.id, firstName: 'Flow', lastName: 'DoctorB', specialization: 'General', qualification: 'MBBS', consultationFee: null },
  });

  const dateA = futureDate(6);
  const dateB = futureDate(7);
  await prisma.doctorAvailability.createMany({
    data: [
      { doctorId: doctorA.id, dayOfWeek: getDayOfWeek(dateA), startTime: '09:00', endTime: '12:00' },
      { doctorId: doctorB.id, dayOfWeek: getDayOfWeek(dateB), startTime: '09:00', endTime: '12:00' },
    ],
  });

  const login = async (email) => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.body.data.accessToken;
  };

  return {
    department, patientA, patientB, doctorA, doctorB, dateA, dateB,
    patientAToken: await login(EMAILS.patientA),
    patientBToken: await login(EMAILS.patientB),
    doctorAToken: await login(EMAILS.doctorA),
    doctorBToken: await login(EMAILS.doctorB),
    adminToken: await login(EMAILS.admin),
  };
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { in: Object.values(EMAILS) } },
    include: { patient: true, doctor: true },
  });
  const patientIds = users.map((u) => u.patient?.id).filter(Boolean);
  const doctorIds = users.map((u) => u.doctor?.id).filter(Boolean);
  const apptWhere = { OR: [{ patientId: { in: patientIds } }, { doctorId: { in: doctorIds } }] };

  // Children first: bills and medical records RESTRICT appointment deletion.
  await prisma.bill.deleteMany({ where: { appointment: apptWhere } });
  await prisma.medicalRecord.deleteMany({ where: { appointment: apptWhere } }); // prescriptions cascade
  await prisma.appointment.deleteMany({ where: apptWhere });
  await prisma.user.deleteMany({ where: { email: { in: Object.values(EMAILS) } } }); // profiles + availability cascade
  await prisma.department.deleteMany({ where: { name: { startsWith: DEPT_PREFIX } } });
}

function futureDate(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
