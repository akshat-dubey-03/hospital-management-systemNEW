// prisma/seed.js
// Demo data seeding script for MediCore HMS.
// Run: npm run db:seed   (or: npx prisma db seed)
//
// IMPORTANT: These are development-only credentials.
// Never use in production.
//
// Repeatable by design:
//   - Every row is written with upsert, keyed by a natural unique key (email,
//     department name, doctor/day/start) or by a fixed demo UUID, so a second
//     run updates the same rows instead of adding duplicates.
//   - Appointment dates are derived from one anchor date (SEED_ANCHOR_DATE,
//     'YYYY-MM-DD', default: today in UTC) and snapped to a weekday on which
//     the doctor actually has an availability block.
//   - All writes run in one interactive transaction: a failure leaves no
//     half-written dataset.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Refusing to seed demo data with NODE_ENV=production.');
  process.exit(1);
}

async function hash(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Fixed IDs for seed rows that have no natural unique key. The ...-b000-...
// namespace keeps them apart from the docs/dbms demo DML (...-a000-...).
const SEED_ID = (n) => `00000000-0000-4000-b000-${String(n).padStart(12, '0')}`;

const anchor = parseAnchor(process.env.SEED_ANCHOR_DATE);

function parseAnchor(value) {
  if (!value) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('SEED_ANCHOR_DATE must use YYYY-MM-DD format.');
  }
  return new Date(`${value}T00:00:00.000Z`);
}

// Date `offsetDays` from the anchor, moved away from the anchor (forward for
// future offsets, backward for past ones) to the nearest date whose weekday is
// `dayOfWeek` (0=Monday … 6=Sunday, the app's convention).
function seedDate(offsetDays, dayOfWeek) {
  const d = new Date(anchor);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const step = offsetDays < 0 ? -1 : 1;
  while ((d.getUTCDay() + 6) % 7 !== dayOfWeek) {
    d.setUTCDate(d.getUTCDate() + step);
  }
  return d;
}

function atTime(date, hhmm) {
  return new Date(`${date.toISOString().slice(0, 10)}T${hhmm}:00.000Z`);
}

async function main() {
  // bcrypt is slow; hash once, outside the transaction.
  const passwords = {
    admin: await hash('Admin@1234'),
    doctor: await hash('Doctor@1234'),
    patient: await hash('Patient@1234'),
  };

  await prisma.$transaction((tx) => seed(tx, passwords), { maxWait: 10_000, timeout: 60_000 });
  printCredentials();
}

async function seed(tx, passwords) {
  console.log('🌱 Starting seed...');

  // ─── 1. Departments ──────────────────────────────────────────
  console.log('Creating departments...');
  const departments = await Promise.all([
    tx.department.upsert({
      where: { name: 'Cardiology' },
      update: {},
      create: {
        name: 'Cardiology',
        description:
          'Specializes in heart diseases, including diagnosis and treatment of conditions such as coronary artery disease, heart failure, and arrhythmias.',
      },
    }),
    tx.department.upsert({
      where: { name: 'Neurology' },
      update: {},
      create: {
        name: 'Neurology',
        description:
          'Deals with disorders of the nervous system including the brain, spinal cord, and peripheral nerves.',
      },
    }),
    tx.department.upsert({
      where: { name: 'Orthopedics' },
      update: {},
      create: {
        name: 'Orthopedics',
        description:
          'Focuses on conditions involving the musculoskeletal system — bones, joints, ligaments, tendons, and muscles.',
      },
    }),
    tx.department.upsert({
      where: { name: 'Pediatrics' },
      update: {},
      create: {
        name: 'Pediatrics',
        description:
          'Medical care of infants, children, and adolescents. Covers preventive care, growth assessment, and treatment of childhood diseases.',
      },
    }),
    tx.department.upsert({
      where: { name: 'Dermatology' },
      update: {},
      create: {
        name: 'Dermatology',
        description:
          'Concerned with skin, hair, and nail conditions including acne, eczema, psoriasis, and skin cancer screening.',
      },
    }),
    tx.department.upsert({
      where: { name: 'General Medicine' },
      update: {},
      create: {
        name: 'General Medicine',
        description:
          'Primary care covering a broad range of conditions. First point of contact for most patients before specialist referral.',
      },
    }),
  ]);

  const deptMap = {};
  for (const dept of departments) {
    deptMap[dept.name] = dept;
  }
  console.log(`  ✓ ${departments.length} departments`);

  // ─── 2. Admin User ────────────────────────────────────────────
  console.log('Creating admin...');
  await tx.user.upsert({
    where: { email: 'admin@medicore.dev' },
    update: {},
    create: {
      email: 'admin@medicore.dev',
      passwordHash: passwords.admin,
      role: 'ADMIN',
    },
  });
  console.log('  ✓ Admin: admin@medicore.dev / Admin@1234');

  // ─── 3. Doctors ───────────────────────────────────────────────
  console.log('Creating doctors...');

  const doctorSeeds = [
    {
      email: 'dr.sharma@medicore.dev',
      firstName: 'Arjun',
      lastName: 'Sharma',
      department: 'Cardiology',
      specialization: 'Interventional Cardiology',
      qualification: 'MBBS, MD (Medicine), DM (Cardiology)',
      experienceYears: 14,
      bio: 'Dr. Arjun Sharma is a senior cardiologist with 14 years of experience in interventional procedures including angioplasty and stent placement. He has performed over 2000 successful cardiac interventions.',
      consultationFee: 800,
      slotDurationMinutes: 30,
      availability: [
        // Mon
        { dayOfWeek: 0, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 0, startTime: '14:00', endTime: '17:00' },
        // Tue
        { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
        // Wed
        { dayOfWeek: 2, startTime: '10:00', endTime: '14:00' },
        // Thu
        { dayOfWeek: 3, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 3, startTime: '14:00', endTime: '17:00' },
        // Fri
        { dayOfWeek: 4, startTime: '09:00', endTime: '12:00' },
      ],
    },
    {
      email: 'dr.kapoor@medicore.dev',
      firstName: 'Priya',
      lastName: 'Kapoor',
      department: 'Neurology',
      specialization: 'Stroke Medicine & Epilepsy',
      qualification: 'MBBS, MD (Medicine), DM (Neurology)',
      experienceYears: 11,
      bio: 'Dr. Priya Kapoor specializes in stroke management and epilepsy treatment. She is trained at NIMHANS and brings a comprehensive approach to neurological care.',
      consultationFee: 700,
      slotDurationMinutes: 30,
      availability: [
        { dayOfWeek: 0, startTime: '10:00', endTime: '14:00' },
        { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' },
        { dayOfWeek: 3, startTime: '10:00', endTime: '14:00' },
        { dayOfWeek: 4, startTime: '09:00', endTime: '13:00' },
      ],
    },
    {
      email: 'dr.mehta@medicore.dev',
      firstName: 'Rohan',
      lastName: 'Mehta',
      department: 'Orthopedics',
      specialization: 'Joint Replacement & Sports Medicine',
      qualification: 'MBBS, MS (Orthopaedics), Fellowship in Joint Replacement',
      experienceYears: 9,
      bio: 'Dr. Rohan Mehta is an orthopedic surgeon with expertise in minimally invasive joint replacement and sports injuries. He has treated numerous professional athletes.',
      consultationFee: 750,
      slotDurationMinutes: 30,
      availability: [
        { dayOfWeek: 0, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 4, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 4, startTime: '14:00', endTime: '17:00' },
      ],
    },
    {
      email: 'dr.singh@medicore.dev',
      firstName: 'Anjali',
      lastName: 'Singh',
      department: 'Pediatrics',
      specialization: 'General Pediatrics & Neonatology',
      qualification: 'MBBS, MD (Pediatrics), Fellowship in Neonatology',
      experienceYears: 8,
      bio: 'Dr. Anjali Singh provides compassionate care for children from birth through adolescence. She is especially experienced in neonatal care and childhood development assessment.',
      consultationFee: 600,
      slotDurationMinutes: 20,
      availability: [
        { dayOfWeek: 0, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 0, startTime: '14:00', endTime: '17:00' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 3, startTime: '14:00', endTime: '17:00' },
        { dayOfWeek: 4, startTime: '10:00', endTime: '14:00' },
      ],
    },
    {
      email: 'dr.gupta@medicore.dev',
      firstName: 'Neha',
      lastName: 'Gupta',
      department: 'Dermatology',
      specialization: 'Cosmetic Dermatology & Skin Oncology',
      qualification: 'MBBS, MD (Dermatology)',
      experienceYears: 7,
      bio: 'Dr. Neha Gupta offers advanced dermatological care including skin cancer screening, acne management, and cosmetic procedures. She believes in evidence-based, personalized skin care.',
      consultationFee: 650,
      slotDurationMinutes: 30,
      availability: [
        { dayOfWeek: 1, startTime: '10:00', endTime: '14:00' },
        { dayOfWeek: 2, startTime: '14:00', endTime: '17:00' },
        { dayOfWeek: 3, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 4, startTime: '09:00', endTime: '12:00' },
      ],
    },
    {
      email: 'dr.verma@medicore.dev',
      firstName: 'Vikram',
      lastName: 'Verma',
      department: 'General Medicine',
      specialization: 'Internal Medicine & Preventive Care',
      qualification: 'MBBS, MD (General Medicine)',
      experienceYears: 12,
      bio: 'Dr. Vikram Verma is a senior physician who serves as the primary care physician for many families. He manages complex multi-system diseases and coordinates specialist referrals.',
      consultationFee: 500,
      slotDurationMinutes: 30,
      availability: [
        { dayOfWeek: 0, startTime: '08:00', endTime: '13:00' },
        { dayOfWeek: 1, startTime: '08:00', endTime: '13:00' },
        { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' },
        { dayOfWeek: 2, startTime: '08:00', endTime: '13:00' },
        { dayOfWeek: 3, startTime: '08:00', endTime: '13:00' },
        { dayOfWeek: 4, startTime: '08:00', endTime: '12:00' },
      ],
    },
  ];

  const doctorMap = {};
  for (const seed of doctorSeeds) {
    const userRecord = await tx.user.upsert({
      where: { email: seed.email },
      update: {},
      create: {
        email: seed.email,
        passwordHash: passwords.doctor,
        role: 'DOCTOR',
      },
    });

    const doctorRecord = await tx.doctor.upsert({
      where: { userId: userRecord.id },
      update: {},
      create: {
        userId: userRecord.id,
        departmentId: deptMap[seed.department].id,
        firstName: seed.firstName,
        lastName: seed.lastName,
        specialization: seed.specialization,
        qualification: seed.qualification,
        experienceYears: seed.experienceYears,
        bio: seed.bio,
        consultationFee: seed.consultationFee,
        slotDurationMinutes: seed.slotDurationMinutes,
      },
    });

    // Upsert availability blocks
    for (const avail of seed.availability) {
      await tx.doctorAvailability.upsert({
        where: {
          doctorId_dayOfWeek_startTime: {
            doctorId: doctorRecord.id,
            dayOfWeek: avail.dayOfWeek,
            startTime: avail.startTime,
          },
        },
        update: { endTime: avail.endTime },
        create: {
          doctorId: doctorRecord.id,
          dayOfWeek: avail.dayOfWeek,
          startTime: avail.startTime,
          endTime: avail.endTime,
        },
      });
    }

    doctorMap[seed.email] = { user: userRecord, doctor: doctorRecord };
    console.log(`  ✓ Dr. ${seed.firstName} ${seed.lastName} (${seed.department})`);
  }

  // ─── 4. Patients ──────────────────────────────────────────────
  console.log('Creating patients...');

  const patientSeeds = [
    {
      email: 'patient1@demo.com',
      firstName: 'Rahul',
      lastName: 'Kumar',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'MALE',
      phone: '9876543210',
      bloodGroup: 'O+',
    },
    {
      email: 'patient2@demo.com',
      firstName: 'Sneha',
      lastName: 'Patel',
      dateOfBirth: new Date('1995-08-22'),
      gender: 'FEMALE',
      phone: '9876543211',
      bloodGroup: 'A+',
    },
    {
      email: 'patient3@demo.com',
      firstName: 'Amit',
      lastName: 'Joshi',
      dateOfBirth: new Date('1985-03-10'),
      gender: 'MALE',
      phone: '9876543212',
      bloodGroup: 'B+',
    },
    {
      email: 'patient4@demo.com',
      firstName: 'Kavya',
      lastName: 'Reddy',
      dateOfBirth: new Date('2000-11-30'),
      gender: 'FEMALE',
      phone: '9876543213',
      bloodGroup: 'AB+',
    },
    {
      email: 'patient5@demo.com',
      firstName: 'Suresh',
      lastName: 'Nair',
      dateOfBirth: new Date('1978-07-04'),
      gender: 'MALE',
      phone: '9876543214',
      bloodGroup: 'O-',
    },
  ];

  const patientMap = {};
  for (const seed of patientSeeds) {
    const userRecord = await tx.user.upsert({
      where: { email: seed.email },
      update: {},
      create: {
        email: seed.email,
        passwordHash: passwords.patient,
        role: 'PATIENT',
      },
    });

    const patientRecord = await tx.patient.upsert({
      where: { userId: userRecord.id },
      update: {},
      create: {
        userId: userRecord.id,
        firstName: seed.firstName,
        lastName: seed.lastName,
        dateOfBirth: seed.dateOfBirth,
        gender: seed.gender,
        phone: seed.phone,
        bloodGroup: seed.bloodGroup,
      },
    });

    patientMap[seed.email] = { user: userRecord, patient: patientRecord };
    console.log(`  ✓ Patient: ${seed.email} / Patient@1234`);
  }

  // ─── 5. Sample Appointments ────────────────────────────────────
  console.log('Creating appointments...');

  const p1 = patientMap['patient1@demo.com'].patient;
  const p2 = patientMap['patient2@demo.com'].patient;
  const p3 = patientMap['patient3@demo.com'].patient;
  const p4 = patientMap['patient4@demo.com'].patient;
  const p5 = patientMap['patient5@demo.com'].patient;

  const drSharma = doctorMap['dr.sharma@medicore.dev'].doctor;
  const drKapoor = doctorMap['dr.kapoor@medicore.dev'].doctor;
  const drMehta = doctorMap['dr.mehta@medicore.dev'].doctor;
  const drSingh = doctorMap['dr.singh@medicore.dev'].doctor;
  const drVerma = doctorMap['dr.verma@medicore.dev'].doctor;

  // Each `day` is a weekday on which that doctor has an availability block
  // covering the slot (see doctorSeeds above).
  const appointmentSeeds = [
    // UPCOMING — BOOKED
    {
      id: SEED_ID(501),
      patientId: p1.id,
      doctorId: drSharma.id,
      appointmentDate: seedDate(3, 1), // Tue 09:00–13:00
      startTime: '10:00',
      endTime: '10:30',
      status: 'BOOKED',
      reasonForVisit: 'Chest discomfort and shortness of breath during exercise',
    },
    {
      id: SEED_ID(502),
      patientId: p2.id,
      doctorId: drKapoor.id,
      appointmentDate: seedDate(5, 1), // Tue 09:00–13:00
      startTime: '11:00',
      endTime: '11:30',
      status: 'BOOKED',
      reasonForVisit: 'Recurring headaches and dizziness',
    },
    // UPCOMING — CONFIRMED
    {
      id: SEED_ID(503),
      patientId: p3.id,
      doctorId: drMehta.id,
      appointmentDate: seedDate(2, 2), // Wed 09:00–13:00
      startTime: '09:00',
      endTime: '09:30',
      status: 'CONFIRMED',
      reasonForVisit: 'Knee pain after sports injury',
    },
    {
      id: SEED_ID(504),
      patientId: p4.id,
      doctorId: drSingh.id,
      appointmentDate: seedDate(7, 0), // Mon 14:00–17:00
      startTime: '14:00',
      endTime: '14:20',
      status: 'CONFIRMED',
      reasonForVisit: 'Routine child health checkup',
    },
    {
      id: SEED_ID(505),
      patientId: p1.id,
      doctorId: drVerma.id,
      appointmentDate: seedDate(4, 3), // Thu 08:00–13:00
      startTime: '08:30',
      endTime: '09:00',
      status: 'CONFIRMED',
      reasonForVisit: 'Annual health checkup',
    },
    // PAST — COMPLETED
    {
      id: SEED_ID(506),
      patientId: p1.id,
      doctorId: drSharma.id,
      appointmentDate: seedDate(-14, 3), // Thu 09:00–13:00
      startTime: '09:30',
      endTime: '10:00',
      status: 'COMPLETED',
      reasonForVisit: 'Follow-up after ECG',
      notes: 'ECG normal. Advised lifestyle modifications. No medication required at this stage.',
    },
    {
      id: SEED_ID(507),
      patientId: p2.id,
      doctorId: drVerma.id,
      appointmentDate: seedDate(-7, 0), // Mon 08:00–13:00
      startTime: '10:00',
      endTime: '10:30',
      status: 'COMPLETED',
      reasonForVisit: 'Fever and cold for 3 days',
      notes: 'Viral infection. Prescribed paracetamol and rest.',
    },
    {
      id: SEED_ID(508),
      patientId: p5.id,
      doctorId: drMehta.id,
      appointmentDate: seedDate(-30, 4), // Fri 14:00–17:00
      startTime: '14:00',
      endTime: '14:30',
      status: 'COMPLETED',
      reasonForVisit: 'Back pain',
      notes: 'Lumbar strain. Physiotherapy recommended.',
    },
    // PAST — CANCELLED (cancelled at noon the day before the visit)
    {
      id: SEED_ID(509),
      patientId: p3.id,
      doctorId: drKapoor.id,
      appointmentDate: seedDate(-5, 0), // Mon 10:00–14:00
      startTime: '10:00',
      endTime: '10:30',
      status: 'CANCELLED_BY_PATIENT',
      reasonForVisit: 'Headache evaluation',
      cancellationReason: 'Could not attend due to personal emergency',
    },
    {
      id: SEED_ID(510),
      patientId: p4.id,
      doctorId: drVerma.id,
      appointmentDate: seedDate(-10, 2), // Wed 08:00–13:00
      startTime: '09:00',
      endTime: '09:30',
      status: 'CANCELLED_BY_DOCTOR',
      reasonForVisit: 'Routine checkup',
      cancellationReason: 'Doctor unavailable due to medical conference',
    },
  ];

  for (const appt of appointmentSeeds) {
    const isCancelled = appt.status.startsWith('CANCELLED');
    const data = {
      ...appt,
      notes: appt.notes ?? null,
      cancellationReason: appt.cancellationReason ?? null,
      cancelledAt: isCancelled ? new Date(atTime(appt.appointmentDate, '12:00').getTime() - 86_400_000) : null,
    };
    const { id, ...update } = data;
    await tx.appointment.upsert({ where: { id }, update, create: data });
  }
  console.log(`  ✓ ${appointmentSeeds.length} appointments`);

  // ─── 6. Feedback ──────────────────────────────────────────────
  console.log('Creating feedback...');

  const feedbackSeeds = [
    {
      id: SEED_ID(601),
      patientId: p1.id,
      subject: 'Excellent care from Dr. Sharma',
      message:
        'Dr. Sharma was very thorough and explained everything clearly. The booking process through MediCore was seamless. Highly recommend!',
      rating: 5,
      isRead: false,
    },
    {
      id: SEED_ID(602),
      patientId: p2.id,
      subject: 'Good experience overall',
      message:
        'The appointment system is very convenient. Dr. Kapoor was knowledgeable and patient. Waiting time was a bit long but overall a good experience.',
      rating: 4,
      isRead: true,
    },
    {
      id: SEED_ID(603),
      patientId: p5.id,
      subject: 'Suggestion for improvement',
      message:
        'It would be helpful to receive appointment reminders via SMS. The system is good but reminders would make it better.',
      rating: 3,
      isRead: false,
    },
  ];

  for (const fb of feedbackSeeds) {
    const { id, ...update } = fb;
    await tx.feedback.upsert({ where: { id }, update, create: fb });
  }
  console.log(`  ✓ ${feedbackSeeds.length} feedback entries`);

  // ─── 7. Queries ───────────────────────────────────────────────
  console.log('Creating queries...');

  const querySeeds = [
    {
      id: SEED_ID(701),
      patientId: p3.id,
      subject: 'How do I reschedule an appointment?',
      message:
        'I need to reschedule my upcoming appointment with Dr. Mehta. The system only shows a cancel option. Can I reschedule without losing my slot?',
      status: 'RESOLVED',
      adminResponse:
        'Thank you for reaching out. Currently, to reschedule you would need to cancel the existing appointment and book a new slot. We are working on a direct reschedule feature. Sorry for the inconvenience.',
      respondedAt: atTime(seedDate(-2, 0), '11:00'),
    },
    {
      id: SEED_ID(702),
      patientId: p4.id,
      subject: 'Doctor availability query',
      message:
        'I would like to know if Dr. Singh is available on Saturday mornings. The system does not show any Saturday slots.',
      status: 'OPEN',
      adminResponse: null,
      respondedAt: null,
    },
    {
      id: SEED_ID(703),
      patientId: p2.id,
      subject: 'Request for medical records',
      message:
        'How can I access my medical records through the portal? I need my previous appointment notes for a visa application.',
      status: 'IN_PROGRESS',
      adminResponse: null,
      respondedAt: null,
    },
  ];

  for (const q of querySeeds) {
    const { id, ...update } = q;
    await tx.query.upsert({ where: { id }, update, create: q });
  }
  console.log(`  ✓ ${querySeeds.length} queries`);

  // ─── 8. Sample Chat Conversation ──────────────────────────────
  console.log('Creating sample chat conversation...');

  const conversation = {
    id: SEED_ID(801),
    patientId: p1.id,
    title: 'Appointment booking help',
    isActive: true,
  };
  {
    const { id, ...update } = conversation;
    await tx.chatConversation.upsert({ where: { id }, update, create: conversation });
  }

  // Explicit createdAt (one second apart) keeps message order deterministic.
  const chatStart = atTime(seedDate(-3, 0), '10:00');
  const messageSeeds = [
    {
      role: 'USER',
      content: 'How do I book an appointment with a cardiologist?',
    },
    {
      role: 'ASSISTANT',
      content:
        "Hi! I'm MediCore Assistant 👋 I'd be happy to help you book an appointment with a cardiologist.\n\nHere's how to do it:\n1. Go to **Find Doctors** in your patient dashboard\n2. Use the department filter and select **Cardiology**\n3. Browse available cardiologists and click on one to view their profile\n4. Click **Book Appointment**\n5. Select an available date and time slot\n6. Confirm your booking\n\nYou'll receive a confirmation, and the appointment will appear in **My Appointments**. Would you like help with anything else?",
    },
    {
      role: 'USER',
      content: 'What should I expect during my first cardiology appointment?',
    },
    {
      role: 'ASSISTANT',
      content:
        "Great question! Here's what to typically expect during a first cardiology consultation:\n\n**Before your appointment:**\n- Arrive 10–15 minutes early for paperwork\n- Bring any previous medical records or test results if available\n- List any medications you're currently taking\n\n**During the appointment:**\n- The doctor will take a detailed medical history\n- A physical examination including blood pressure, heart rate\n- They may order tests like an ECG or echocardiogram\n\n**Important:** I'm an AI assistant and not a medical professional. The exact nature of your appointment will depend on your specific situation. Your doctor will guide you appropriately.\n\nIs there anything else I can help with?",
    },
  ].map((msg, i) => ({
    id: SEED_ID(901 + i),
    conversationId: conversation.id,
    createdAt: new Date(chatStart.getTime() + i * 1000),
    ...msg,
  }));

  for (const msg of messageSeeds) {
    const { id, ...update } = msg;
    await tx.chatMessage.upsert({ where: { id }, update, create: msg });
  }
  console.log(`  ✓ 1 sample conversation with ${messageSeeds.length} messages`);

  console.log(`\n✅ Seed completed (anchor date ${anchor.toISOString().slice(0, 10)}).`);
}

function printCredentials() {
  console.log('\n─────────────────────────────────────────────');
  console.log('Demo Login Credentials (development only):');
  console.log('─────────────────────────────────────────────');
  console.log('Admin:   admin@medicore.dev    / Admin@1234');
  console.log('Doctors: dr.sharma@medicore.dev / Doctor@1234');
  console.log('         dr.kapoor@medicore.dev / Doctor@1234');
  console.log('         dr.mehta@medicore.dev  / Doctor@1234');
  console.log('         dr.singh@medicore.dev  / Doctor@1234');
  console.log('         dr.verma@medicore.dev  / Doctor@1234');
  console.log('         dr.gupta@medicore.dev  / Doctor@1234');
  console.log('Patients: patient1@demo.com    / Patient@1234');
  console.log('          patient2@demo.com    / Patient@1234');
  console.log('          patient3@demo.com    / Patient@1234');
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
