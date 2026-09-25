// prisma/seed.js
// Demo data seeding script for MediCore HMS.
// Run: npm run db:seed
//
// IMPORTANT: These are development-only credentials.
// Never use in production.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function hash(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function main() {
  console.log('🌱 Starting seed...');

  // ─── 1. Departments ──────────────────────────────────────────
  console.log('Creating departments...');
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { name: 'Cardiology' },
      update: {},
      create: {
        name: 'Cardiology',
        description:
          'Specializes in heart diseases, including diagnosis and treatment of conditions such as coronary artery disease, heart failure, and arrhythmias.',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Neurology' },
      update: {},
      create: {
        name: 'Neurology',
        description:
          'Deals with disorders of the nervous system including the brain, spinal cord, and peripheral nerves.',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Orthopedics' },
      update: {},
      create: {
        name: 'Orthopedics',
        description:
          'Focuses on conditions involving the musculoskeletal system — bones, joints, ligaments, tendons, and muscles.',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Pediatrics' },
      update: {},
      create: {
        name: 'Pediatrics',
        description:
          'Medical care of infants, children, and adolescents. Covers preventive care, growth assessment, and treatment of childhood diseases.',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Dermatology' },
      update: {},
      create: {
        name: 'Dermatology',
        description:
          'Concerned with skin, hair, and nail conditions including acne, eczema, psoriasis, and skin cancer screening.',
      },
    }),
    prisma.department.upsert({
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
  await prisma.user.upsert({
    where: { email: 'admin@medicore.dev' },
    update: {},
    create: {
      email: 'admin@medicore.dev',
      passwordHash: await hash('Admin@1234'),
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
    const userRecord = await prisma.user.upsert({
      where: { email: seed.email },
      update: {},
      create: {
        email: seed.email,
        passwordHash: await hash('Doctor@1234'),
        role: 'DOCTOR',
      },
    });

    const doctorRecord = await prisma.doctor.upsert({
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
      await prisma.doctorAvailability.upsert({
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
    const userRecord = await prisma.user.upsert({
      where: { email: seed.email },
      update: {},
      create: {
        email: seed.email,
        passwordHash: await hash('Patient@1234'),
        role: 'PATIENT',
      },
    });

    const patientRecord = await prisma.patient.upsert({
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

  // Helper: date offset from today
  function offsetDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

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

  const appointmentSeeds = [
    // UPCOMING — BOOKED
    {
      patientId: p1.id,
      doctorId: drSharma.id,
      appointmentDate: offsetDate(3),
      startTime: '10:00',
      endTime: '10:30',
      status: 'BOOKED',
      reasonForVisit: 'Chest discomfort and shortness of breath during exercise',
    },
    {
      patientId: p2.id,
      doctorId: drKapoor.id,
      appointmentDate: offsetDate(5),
      startTime: '11:00',
      endTime: '11:30',
      status: 'BOOKED',
      reasonForVisit: 'Recurring headaches and dizziness',
    },
    // UPCOMING — CONFIRMED
    {
      patientId: p3.id,
      doctorId: drMehta.id,
      appointmentDate: offsetDate(2),
      startTime: '09:00',
      endTime: '09:30',
      status: 'CONFIRMED',
      reasonForVisit: 'Knee pain after sports injury',
    },
    {
      patientId: p4.id,
      doctorId: drSingh.id,
      appointmentDate: offsetDate(7),
      startTime: '14:00',
      endTime: '14:20',
      status: 'CONFIRMED',
      reasonForVisit: 'Routine child health checkup',
    },
    {
      patientId: p1.id,
      doctorId: drVerma.id,
      appointmentDate: offsetDate(4),
      startTime: '08:30',
      endTime: '09:00',
      status: 'CONFIRMED',
      reasonForVisit: 'Annual health checkup',
    },
    // PAST — COMPLETED
    {
      patientId: p1.id,
      doctorId: drSharma.id,
      appointmentDate: offsetDate(-14),
      startTime: '09:30',
      endTime: '10:00',
      status: 'COMPLETED',
      reasonForVisit: 'Follow-up after ECG',
      notes: 'ECG normal. Advised lifestyle modifications. No medication required at this stage.',
    },
    {
      patientId: p2.id,
      doctorId: drVerma.id,
      appointmentDate: offsetDate(-7),
      startTime: '10:00',
      endTime: '10:30',
      status: 'COMPLETED',
      reasonForVisit: 'Fever and cold for 3 days',
      notes: 'Viral infection. Prescribed paracetamol and rest.',
    },
    {
      patientId: p5.id,
      doctorId: drMehta.id,
      appointmentDate: offsetDate(-30),
      startTime: '14:00',
      endTime: '14:30',
      status: 'COMPLETED',
      reasonForVisit: 'Back pain',
      notes: 'Lumbar strain. Physiotherapy recommended.',
    },
    // PAST — CANCELLED
    {
      patientId: p3.id,
      doctorId: drKapoor.id,
      appointmentDate: offsetDate(-5),
      startTime: '10:00',
      endTime: '10:30',
      status: 'CANCELLED_BY_PATIENT',
      reasonForVisit: 'Headache evaluation',
      cancellationReason: 'Could not attend due to personal emergency',
      cancelledAt: new Date(),
    },
    {
      patientId: p4.id,
      doctorId: drVerma.id,
      appointmentDate: offsetDate(-10),
      startTime: '09:00',
      endTime: '09:30',
      status: 'CANCELLED_BY_DOCTOR',
      reasonForVisit: 'Routine checkup',
      cancellationReason: 'Doctor unavailable due to medical conference',
      cancelledAt: new Date(),
    },
  ];

  for (const appt of appointmentSeeds) {
    await prisma.appointment.create({ data: appt });
  }
  console.log(`  ✓ ${appointmentSeeds.length} appointments`);

  // ─── 6. Feedback ──────────────────────────────────────────────
  console.log('Creating feedback...');

  await prisma.feedback.createMany({
    data: [
      {
        patientId: p1.id,
        subject: 'Excellent care from Dr. Sharma',
        message:
          'Dr. Sharma was very thorough and explained everything clearly. The booking process through MediCore was seamless. Highly recommend!',
        rating: 5,
        isRead: false,
      },
      {
        patientId: p2.id,
        subject: 'Good experience overall',
        message:
          'The appointment system is very convenient. Dr. Kapoor was knowledgeable and patient. Waiting time was a bit long but overall a good experience.',
        rating: 4,
        isRead: true,
      },
      {
        patientId: p5.id,
        subject: 'Suggestion for improvement',
        message:
          'It would be helpful to receive appointment reminders via SMS. The system is good but reminders would make it better.',
        rating: 3,
        isRead: false,
      },
    ],
  });
  console.log('  ✓ 3 feedback entries');

  // ─── 7. Queries ───────────────────────────────────────────────
  console.log('Creating queries...');

  await prisma.query.createMany({
    data: [
      {
        patientId: p3.id,
        subject: 'How do I reschedule an appointment?',
        message:
          'I need to reschedule my upcoming appointment with Dr. Mehta. The system only shows a cancel option. Can I reschedule without losing my slot?',
        status: 'RESOLVED',
        adminResponse:
          'Thank you for reaching out. Currently, to reschedule you would need to cancel the existing appointment and book a new slot. We are working on a direct reschedule feature. Sorry for the inconvenience.',
        respondedAt: new Date(),
      },
      {
        patientId: p4.id,
        subject: 'Doctor availability query',
        message:
          'I would like to know if Dr. Singh is available on Saturday mornings. The system does not show any Saturday slots.',
        status: 'OPEN',
      },
      {
        patientId: p2.id,
        subject: 'Request for medical records',
        message:
          'How can I access my medical records through the portal? I need my previous appointment notes for a visa application.',
        status: 'IN_PROGRESS',
      },
    ],
  });
  console.log('  ✓ 3 queries');

  // ─── 8. Sample Chat Conversation ──────────────────────────────
  console.log('Creating sample chat conversation...');

  const conv = await prisma.chatConversation.create({
    data: {
      patientId: p1.id,
      title: 'Appointment booking help',
    },
  });

  await prisma.chatMessage.createMany({
    data: [
      {
        conversationId: conv.id,
        role: 'USER',
        content: 'How do I book an appointment with a cardiologist?',
      },
      {
        conversationId: conv.id,
        role: 'ASSISTANT',
        content:
          "Hi! I'm MediCore Assistant 👋 I'd be happy to help you book an appointment with a cardiologist.\n\nHere's how to do it:\n1. Go to **Find Doctors** in your patient dashboard\n2. Use the department filter and select **Cardiology**\n3. Browse available cardiologists and click on one to view their profile\n4. Click **Book Appointment**\n5. Select an available date and time slot\n6. Confirm your booking\n\nYou'll receive a confirmation, and the appointment will appear in **My Appointments**. Would you like help with anything else?",
      },
      {
        conversationId: conv.id,
        role: 'USER',
        content: 'What should I expect during my first cardiology appointment?',
      },
      {
        conversationId: conv.id,
        role: 'ASSISTANT',
        content:
          "Great question! Here's what to typically expect during a first cardiology consultation:\n\n**Before your appointment:**\n- Arrive 10–15 minutes early for paperwork\n- Bring any previous medical records or test results if available\n- List any medications you're currently taking\n\n**During the appointment:**\n- The doctor will take a detailed medical history\n- A physical examination including blood pressure, heart rate\n- They may order tests like an ECG or echocardiogram\n\n**Important:** I'm an AI assistant and not a medical professional. The exact nature of your appointment will depend on your specific situation. Your doctor will guide you appropriately.\n\nIs there anything else I can help with?",
      },
    ],
  });
  console.log('  ✓ 1 sample conversation with 4 messages');

  console.log('\n✅ Seed completed successfully!');
  console.log('\n─────────────────────────────────────────────');
  console.log('Demo Login Credentials:');
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
