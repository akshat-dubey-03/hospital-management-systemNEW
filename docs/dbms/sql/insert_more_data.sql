-- =============================================================================
-- MediCore HMS — Insert 10+ Additional Records Per Table
-- =============================================================================
-- Adds realistic, non-colliding clinical and administrative data to:
--   1. departments (+10 rows)
--   2. users (+20 rows: 10 doctors + 10 patients)
--   3. doctors (+10 rows)
--   4. patients (+10 rows)
--   5. doctor_availability (+10 rows)
--   6. appointments (+10 rows)
--   7. feedback (+10 rows)
--   8. queries (+10 rows)
--   9. chat_conversations (+10 rows)
--  10. chat_messages (+10 rows)
--
-- All UUIDs are valid RFC-compliant hex strings.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. DEPARTMENTS (10 new rows)
-- -----------------------------------------------------------------------------
INSERT INTO "departments" ("id", "name", "description", "createdAt")
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Oncology', 'Diagnosis and treatment of various types of cancers and tumors.', CURRENT_TIMESTAMP),
  ('a1000000-0000-0000-0000-000000000002', 'ENT (Otolaryngology)', 'Comprehensive care for ear, nose, and throat conditions.', CURRENT_TIMESTAMP),
  ('a1000000-0000-0000-0000-000000000003', 'Ophthalmology', 'Medical and surgical eye care, vision correction, and cataract treatment.', CURRENT_TIMESTAMP),
  ('a1000000-0000-0000-0000-000000000004', 'Psychiatry', 'Mental health evaluation, counseling, psychotherapy, and behavioral health.', CURRENT_TIMESTAMP),
  ('a1000000-0000-0000-0000-000000000005', 'Radiology', 'Diagnostic imaging including MRI, CT, X-Ray, and Ultrasound services.', CURRENT_TIMESTAMP),
  ('a1000000-0000-0000-0000-000000000006', 'Gynecology & Obstetrics', 'Women reproductive health, maternal care, and childbirth support.', CURRENT_TIMESTAMP),
  ('a1000000-0000-0000-0000-000000000007', 'Nephrology', 'Kidney function care, dialysis management, and renal disease therapy.', CURRENT_TIMESTAMP),
  ('a1000000-0000-0000-0000-000000000008', 'Urology', 'Urinary tract disorders and male reproductive health.', CURRENT_TIMESTAMP),
  ('a1000000-0000-0000-0000-000000000009', 'Gastroenterology', 'Digestive system, liver, pancreas, and gastrointestinal endoscopy.', CURRENT_TIMESTAMP),
  ('a1000000-0000-0000-0000-000000000010', 'Endocrinology', 'Hormonal disorders, diabetes care, thyroid, and metabolic therapies.', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. USERS (20 new rows: 10 for Doctors, 10 for Patients)
-- -----------------------------------------------------------------------------
INSERT INTO "users" ("id", "email", "passwordHash", "role", "isActive", "createdAt", "updatedAt")
VALUES
  -- 10 Doctor User Accounts
  ('11000000-0000-0000-0000-000000000001', 'dr.iyer@medicore.dev', '$2a$12$e8FhL2mO.placeholderhashforgrowth001', 'DOCTOR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11000000-0000-0000-0000-000000000002', 'dr.chatterjee@medicore.dev', '$2a$12$e8FhL2mO.placeholderhashforgrowth002', 'DOCTOR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11000000-0000-0000-0000-000000000003', 'dr.deshmukh@medicore.dev', '$2a$12$e8FhL2mO.placeholderhashforgrowth003', 'DOCTOR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11000000-0000-0000-0000-000000000004', 'dr.nambiar@medicore.dev', '$2a$12$e8FhL2mO.placeholderhashforgrowth004', 'DOCTOR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11000000-0000-0000-0000-000000000005', 'dr.bhatia@medicore.dev', '$2a$12$e8FhL2mO.placeholderhashforgrowth005', 'DOCTOR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11000000-0000-0000-0000-000000000006', 'dr.kulkarni@medicore.dev', '$2a$12$e8FhL2mO.placeholderhashforgrowth006', 'DOCTOR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11000000-0000-0000-0000-000000000007', 'dr.saxena@medicore.dev', '$2a$12$e8FhL2mO.placeholderhashforgrowth007', 'DOCTOR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11000000-0000-0000-0000-000000000008', 'dr.pillai@medicore.dev', '$2a$12$e8FhL2mO.placeholderhashforgrowth008', 'DOCTOR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11000000-0000-0000-0000-000000000009', 'dr.menon@medicore.dev', '$2a$12$e8FhL2mO.placeholderhashforgrowth009', 'DOCTOR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11000000-0000-0000-0000-000000000010', 'dr.sen@medicore.dev', '$2a$12$e8FhL2mO.placeholderhashforgrowth010', 'DOCTOR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  -- 10 Patient User Accounts
  ('22000000-0000-0000-0000-000000000001', 'patient6@demo.com', '$2a$12$e8FhL2mO.placeholderhashpatient001', 'PATIENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('22000000-0000-0000-0000-000000000002', 'patient7@demo.com', '$2a$12$e8FhL2mO.placeholderhashpatient002', 'PATIENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('22000000-0000-0000-0000-000000000003', 'patient8@demo.com', '$2a$12$e8FhL2mO.placeholderhashpatient003', 'PATIENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('22000000-0000-0000-0000-000000000004', 'patient9@demo.com', '$2a$12$e8FhL2mO.placeholderhashpatient004', 'PATIENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('22000000-0000-0000-0000-000000000005', 'patient10@demo.com', '$2a$12$e8FhL2mO.placeholderhashpatient005', 'PATIENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('22000000-0000-0000-0000-000000000006', 'patient11@demo.com', '$2a$12$e8FhL2mO.placeholderhashpatient006', 'PATIENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('22000000-0000-0000-0000-000000000007', 'patient12@demo.com', '$2a$12$e8FhL2mO.placeholderhashpatient007', 'PATIENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('22000000-0000-0000-0000-000000000008', 'patient13@demo.com', '$2a$12$e8FhL2mO.placeholderhashpatient008', 'PATIENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('22000000-0000-0000-0000-000000000009', 'patient14@demo.com', '$2a$12$e8FhL2mO.placeholderhashpatient009', 'PATIENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('22000000-0000-0000-0000-000000000010', 'patient15@demo.com', '$2a$12$e8FhL2mO.placeholderhashpatient010', 'PATIENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. DOCTORS (10 new rows)
-- -----------------------------------------------------------------------------
INSERT INTO "doctors" (
  "id", "userId", "departmentId", "firstName", "lastName", "specialization",
  "qualification", "experienceYears", "bio", "phone", "consultationFee",
  "slotDurationMinutes", "isActive", "createdAt", "updatedAt"
) VALUES
  ('d1000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Kavitha', 'Iyer', 'Medical Oncology', 'MBBS, MD, DM (Oncology)', 14, 'Specialist in chemotherapy and precision targeted cancer therapies.', '9876500001', 950.00, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('d1000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'Subhash', 'Chatterjee', 'Rhinology & Sinus Surgery', 'MBBS, MS (ENT)', 11, 'Expertise in endoscopic sinus surgeries and hearing restoration.', '9876500002', 700.00, 25, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('d1000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'Manish', 'Deshmukh', 'Cornea & Refractive Surgery', 'MBBS, MD (Ophthalmology)', 16, 'Pioneer in laser vision correction and cataract microsurgery.', '9876500003', 850.00, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('d1000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'Deepa', 'Nambiar', 'Clinical Psychiatry', 'MBBS, MD (Psychiatry)', 9, 'Focuses on anxiety, clinical depression, and adult mood disorders.', '9876500004', 800.00, 45, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('d1000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 'Rajesh', 'Bhatia', 'Interventional Radiology', 'MBBS, MD (Radiology)', 12, 'Advanced imaging diagnostics and image-guided minimally invasive therapy.', '9876500005', 750.00, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('d1000000-0000-0000-0000-000000000006', '11000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006', 'Sunita', 'Kulkarni', 'Obstetrics & High-Risk Pregnancy', 'MBBS, MS (OBG)', 18, 'Dedicated to maternal-fetal medicine and laparoscopic gynecologic surgery.', '9876500006', 900.00, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('d1000000-0000-0000-0000-000000000007', '11000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000007', 'Amitabh', 'Saxena', 'Nephrology & Renal Transplant', 'MBBS, MD, DM (Nephrology)', 15, 'Specialized in chronic kidney management and kidney transplant follow-ups.', '9876500007', 900.00, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('d1000000-0000-0000-0000-000000000008', '11000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000008', 'Girish', 'Pillai', 'Endourology & Urologic Oncology', 'MBBS, MS, MCh (Urology)', 13, 'Expert in kidney stone management and robotic urological surgery.', '9876500008', 850.00, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('d1000000-0000-0000-0000-000000000009', '11000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000009', 'Radhika', 'Menon', 'Hepatology & Gastroenterology', 'MBBS, MD, DM (Gastro)', 10, 'Focus on inflammatory bowel disease, fatty liver, and GI wellness.', '9876500009', 800.00, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('d1000000-0000-0000-0000-000000000010', '11000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000010', 'Tapan', 'Sen', 'Diabetology & Endocrinology', 'MBBS, MD, DM (Endo)', 17, 'Comprehensive management of complex diabetes, thyroid, and pituitary disorders.', '9876500010', 800.00, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("userId") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. PATIENTS (10 new rows)
-- -----------------------------------------------------------------------------
INSERT INTO "patients" (
  "id", "userId", "firstName", "lastName", "dateOfBirth", "gender",
  "phone", "address", "bloodGroup", "createdAt", "updatedAt"
) VALUES
  ('44000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 'Pooja', 'Verma', '1992-04-12', 'FEMALE', '9876510001', '45 Indiranagar, Bengaluru, KA', 'B+', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('44000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000002', 'Aditya', 'Singhania', '1988-11-25', 'MALE', '9876510002', '12 Koregaon Park, Pune, MH', 'O+', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('44000000-0000-0000-0000-000000000003', '22000000-0000-0000-0000-000000000003', 'Meera', 'Ranganathan', '1996-02-18', 'FEMALE', '9876510003', '78 T. Nagar, Chennai, TN', 'A-', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('44000000-0000-0000-0000-000000000004', '22000000-0000-0000-0000-000000000004', 'Harish', 'Chauhan', '1975-09-08', 'MALE', '9876510004', '22 Sector 14, Gurugram, HR', 'AB+', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('44000000-0000-0000-0000-000000000005', '22000000-0000-0000-0000-000000000005', 'Tanvi', 'Mishra', '2001-07-30', 'FEMALE', '9876510005', '89 Aliganj, Lucknow, UP', 'O-', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('44000000-0000-0000-0000-000000000006', '22000000-0000-0000-0000-000000000006', 'Siddharth', 'Bose', '1983-05-14', 'MALE', '9876510006', '54 Salt Lake, Sector 2, Kolkata, WB', 'A+', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('44000000-0000-0000-0000-000000000007', '22000000-0000-0000-0000-000000000007', 'Divya', 'Nair', '1994-12-03', 'FEMALE', '9876510007', '19 Panampilly Nagar, Kochi, KL', 'B-', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('44000000-0000-0000-0000-000000000008', '22000000-0000-0000-0000-000000000008', 'Gaurav', 'Malhotra', '1990-01-20', 'MALE', '9876510008', '33 Civil Lines, Jaipur, RJ', 'AB-', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('44000000-0000-0000-0000-000000000009', '22000000-0000-0000-0000-000000000009', 'Shalini', 'Kashyap', '1987-08-16', 'FEMALE', '9876510009', '61 Banjara Hills, Hyderabad, TS', 'O+', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('44000000-0000-0000-0000-000000000010', '22000000-0000-0000-0000-000000000010', 'Nikhil', 'Pandey', '1998-03-22', 'MALE', '9876510010', '102 Navrangpura, Ahmedabad, GJ', 'B+', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("userId") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. DOCTOR_AVAILABILITY (10 new schedule blocks)
-- -----------------------------------------------------------------------------
INSERT INTO "doctor_availability" ("id", "doctorId", "dayOfWeek", "startTime", "endTime", "isActive")
VALUES
  ('b1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 0, '10:00', '14:00', true),
  ('b1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', 1, '09:00', '13:00', true),
  ('b1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000003', 2, '11:00', '15:00', true),
  ('b1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000004', 3, '14:00', '18:00', true),
  ('b1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000005', 4, '08:30', '12:30', true),
  ('b1000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000006', 0, '09:00', '13:00', true),
  ('b1000000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000007', 1, '10:00', '14:00', true),
  ('b1000000-0000-0000-0000-000000000008', 'd1000000-0000-0000-0000-000000000008', 2, '13:00', '17:00', true),
  ('b1000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000009', 3, '09:30', '13:30', true),
  ('b1000000-0000-0000-0000-000000000010', 'd1000000-0000-0000-0000-000000000010', 4, '10:00', '14:00', true)
ON CONFLICT ("doctorId", "dayOfWeek", "startTime") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. APPOINTMENTS (10 new appointments)
-- -----------------------------------------------------------------------------
INSERT INTO "appointments" (
  "id", "patientId", "doctorId", "appointmentDate", "startTime", "endTime",
  "status", "reasonForVisit", "notes", "createdAt", "updatedAt"
) VALUES
  ('c1000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', '2026-11-02', '10:00', '10:30', 'CONFIRMED', 'Second opinion on biopsy report', 'Bring original histopathology slides', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('c1000000-0000-0000-0000-000000000002', '44000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', '2026-11-03', '09:00', '09:25', 'BOOKED', 'Chronic nasal congestion and snoring', 'Evaluate for deviated nasal septum', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('c1000000-0000-0000-0000-000000000003', '44000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000003', '2026-11-04', '11:00', '11:20', 'CONFIRMED', 'Blurry vision and eye strain while reading', 'Perform dilated fundus exam', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('c1000000-0000-0000-0000-000000000004', '44000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000004', '2026-11-05', '14:00', '14:45', 'BOOKED', 'Insomnia and persistent work-related anxiety', 'Initial psychiatric consultation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('c1000000-0000-0000-0000-000000000005', '44000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000005', '2026-11-06', '08:30', '09:00', 'COMPLETED', 'Abdominal ultrasound screening', 'No gallstones or hepatomegaly seen', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('c1000000-0000-0000-0000-000000000006', '44000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000006', '2026-11-09', '09:30', '10:00', 'CONFIRMED', 'First trimester routine antenatal checkup', 'Review prenatal vitamins and ultrasound', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('c1000000-0000-0000-0000-000000000007', '44000000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000007', '2026-11-10', '10:00', '10:30', 'BOOKED', 'Elevated serum creatinine follow-up', 'Patient advised to bring past 3 months lab panels', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('c1000000-0000-0000-0000-000000000008', '44000000-0000-0000-0000-000000000008', 'd1000000-0000-0000-0000-000000000008', '2026-11-11', '13:00', '13:30', 'CONFIRMED', 'Flank pain and suspected renal calculi', 'Check KUB ultrasound results', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('c1000000-0000-0000-0000-000000000009', '44000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000009', '2026-11-12', '09:30', '10:00', 'COMPLETED', 'Persistent acid reflux and epigastric burning', 'Prescribed PPI trial for 4 weeks', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('c1000000-0000-0000-0000-000000000010', '44000000-0000-0000-0000-000000000010', 'd1000000-0000-0000-0000-000000000010', '2026-11-13', '10:00', '10:20', 'BOOKED', 'HbA1c monitoring and thyroid dosage review', 'Fasting blood glucose panel required', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. FEEDBACK (10 new rows)
-- -----------------------------------------------------------------------------
INSERT INTO "feedback" ("id", "patientId", "subject", "message", "rating", "isRead", "createdAt")
VALUES
  ('f1000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', 'Outstanding Oncology Consultation', 'Dr. Iyer explained the chemo roadmap with incredible empathy and clarity.', 5, true, CURRENT_TIMESTAMP),
  ('f1000000-0000-0000-0000-000000000002', '44000000-0000-0000-0000-000000000002', 'Smooth ENT Examination', 'Quick diagnosis of my sinusitis. Waiting room was clean and well organized.', 5, true, CURRENT_TIMESTAMP),
  ('f1000000-0000-0000-0000-000000000003', '44000000-0000-0000-0000-000000000003', 'Helpful Eye Checkup', 'Dr. Deshmukh was very patient while checking my spectacle power.', 4, false, CURRENT_TIMESTAMP),
  ('f1000000-0000-0000-0000-000000000004', '44000000-0000-0000-0000-000000000004', 'Comfortable Counseling Session', 'Safe environment and attentive listening. Highly recommend the mental health team.', 5, false, CURRENT_TIMESTAMP),
  ('f1000000-0000-0000-0000-000000000005', '44000000-0000-0000-0000-000000000005', 'Prompt Ultrasound Report Delivery', 'Imaging completed on time and digital report was ready within an hour.', 4, true, CURRENT_TIMESTAMP),
  ('f1000000-0000-0000-0000-000000000006', '44000000-0000-0000-0000-000000000006', 'Compassionate Antenatal Care', 'Dr. Sunita Kulkarni is wonderful. Addressed all first-time pregnancy worries.', 5, true, CURRENT_TIMESTAMP),
  ('f1000000-0000-0000-0000-000000000007', '44000000-0000-0000-0000-000000000007', 'Knowledgeable Nephrology Care', 'Very thorough analysis of kidney panels. Lifestyle changes suggested were practical.', 4, false, CURRENT_TIMESTAMP),
  ('f1000000-0000-0000-0000-000000000008', '44000000-0000-0000-0000-000000000008', 'Effective Kidney Stone Guidance', 'Clear dietary precautions given along with modern medication.', 4, false, CURRENT_TIMESTAMP),
  ('f1000000-0000-0000-0000-000000000009', '44000000-0000-0000-0000-000000000009', 'Great Relief for Acidity', 'Diet plan coupled with prescribed medicine provided rapid heartburn relief.', 5, true, CURRENT_TIMESTAMP),
  ('f1000000-0000-0000-0000-000000000010', '44000000-0000-0000-0000-000000000010', 'Diabetic Management Review', 'Sugar readings stabilized after Dr. Sen adjusted insulin dosage timing.', 5, false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. QUERIES (10 new rows)
-- -----------------------------------------------------------------------------
INSERT INTO "queries" (
  "id", "patientId", "subject", "message", "status", "adminResponse",
  "respondedAt", "createdAt", "updatedAt"
) VALUES
  ('99000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', 'Chemotherapy daycare timings', 'Can chemotherapy daycare admissions be done on Saturday mornings?', 'RESOLVED', 'Yes, our Oncology Daycare operates from 8:00 AM to 4:00 PM on Saturdays with pre-booking.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('99000000-0000-0000-0000-000000000002', '44000000-0000-0000-0000-000000000002', 'Audiometry test scheduling', 'Do I need a separate doctor referral before scheduling an audiometry test?', 'OPEN', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('99000000-0000-0000-0000-000000000003', '44000000-0000-0000-0000-000000000003', 'Laser surgery cashless insurance', 'Does the hospital support Star Health cashless for cataract surgeries?', 'IN_PROGRESS', 'We have forwarded your TPA card details to the insurance desk for pre-authorization.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('99000000-0000-0000-0000-000000000004', '44000000-0000-0000-0000-000000000004', 'Online counseling tele-consultation', 'Is it possible to switch psychiatric follow-up to an online video call?', 'RESOLVED', 'Yes, video consultations can be booked under the Find Doctors tab by filtering for tele-consult.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('99000000-0000-0000-0000-000000000005', '44000000-0000-0000-0000-000000000005', 'CD copy of MRI Scan', 'How can I obtain a DICOM CD copy of my spinal MRI scan?', 'RESOLVED', 'You can collect the DICOM CD from the Radiology desk on Floor 1 between 9 AM and 6 PM.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('99000000-0000-0000-0000-000000000006', '44000000-0000-0000-0000-000000000006', 'Maternity admission package details', 'Please share the brochure for standard vs luxury maternity delivery packages.', 'IN_PROGRESS', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('99000000-0000-0000-0000-000000000007', '44000000-0000-0000-0000-000000000007', 'Dialysis shift booking', 'Can dialysis slots be rescheduled to the evening shift (6 PM - 10 PM)?', 'OPEN', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('99000000-0000-0000-0000-000000000008', '44000000-0000-0000-0000-000000000008', 'Preparation instructions for Lithotripsy', 'Are there any dietary restrictions or fasting requirements before kidney stone shockwave therapy?', 'RESOLVED', 'Please maintain 6 hours fasting prior to the procedure. Clear water is permissible up to 2 hours before.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('99000000-0000-0000-0000-000000000009', '44000000-0000-0000-0000-000000000009', 'Endoscopy sedation enquiry', 'Is upper GI endoscopy conducted under conscious sedation or general anesthesia?', 'OPEN', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('99000000-0000-0000-0000-000000000010', '44000000-0000-0000-0000-000000000010', 'Continuous Glucose Monitor (CGM) sensor attachment', 'Does MediCore provide support for pairing Abbott Freestyle Libre sensors?', 'RESOLVED', 'Yes, our diabetes educator on Floor 2 assists with sensor pairing every weekday morning.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9. CHAT_CONVERSATIONS (10 new conversations)
-- -----------------------------------------------------------------------------
INSERT INTO "chat_conversations" ("id", "patientId", "title", "isActive", "createdAt", "updatedAt")
VALUES
  ('e1000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', 'Cancer screening guidelines', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('e1000000-0000-0000-0000-000000000002', '44000000-0000-0000-0000-000000000002', 'Sinusitis remedies and vapor inhalation', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('e1000000-0000-0000-0000-000000000003', '44000000-0000-0000-0000-000000000003', 'Computer eye strain relief 20-20-20 rule', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('e1000000-0000-0000-0000-000000000004', '44000000-0000-0000-0000-000000000004', 'Sleep hygiene tips for severe insomnia', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('e1000000-0000-0000-0000-000000000005', '44000000-0000-0000-0000-000000000005', 'Understanding ultrasound abdominal reports', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('e1000000-0000-0000-0000-000000000006', '44000000-0000-0000-0000-000000000006', 'Prenatal dietary checklist first trimester', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('e1000000-0000-0000-0000-000000000007', '44000000-0000-0000-0000-000000000007', 'Hydration guidelines for kidney health', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('e1000000-0000-0000-0000-000000000008', '44000000-0000-0000-0000-000000000008', 'Preventing calcium oxalate kidney stones', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('e1000000-0000-0000-0000-000000000009', '44000000-0000-0000-0000-000000000009', 'Managing GERD acid reflux naturally', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('e1000000-0000-0000-0000-000000000010', '44000000-0000-0000-0000-000000000010', 'Low glycemic index meals for diabetes', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 10. CHAT_MESSAGES (10 new messages linked to conversations)
-- -----------------------------------------------------------------------------
INSERT INTO "chat_messages" ("id", "conversationId", "role", "content", "tokenCount", "createdAt")
VALUES
  ('88000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'USER', 'What annual cancer screening checks are advised for adults above 40?', 16, CURRENT_TIMESTAMP),
  ('88000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'USER', 'How many times a day is saline nasal rinse safe for chronic sinus pressure?', 18, CURRENT_TIMESTAMP),
  ('88000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 'USER', 'Can blue-light filtering glasses prevent dry eyes during 8 hours of screen work?', 17, CURRENT_TIMESTAMP),
  ('88000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000004', 'USER', 'Is it safe to take melatonin supplements without a prescription for mild jet lag?', 18, CURRENT_TIMESTAMP),
  ('88000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000005', 'USER', 'What does Grade 1 fatty liver mean on an abdominal ultrasound report?', 16, CURRENT_TIMESTAMP),
  ('88000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000006', 'USER', 'Which food sources provide natural folic acid during early pregnancy?', 14, CURRENT_TIMESTAMP),
  ('88000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000007', 'USER', 'How much water should a healthy adult drink daily to prevent kidney strain?', 16, CURRENT_TIMESTAMP),
  ('88000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000008', 'USER', 'Should I completely avoid spinach and tomatoes if I have calcium oxalate stones?', 17, CURRENT_TIMESTAMP),
  ('88000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000009', 'USER', 'Is sleeping on the left side scientifically proven to reduce nighttime acid reflux?', 16, CURRENT_TIMESTAMP),
  ('88000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000010', 'USER', 'What are good afternoon snack alternatives to prevent post-meal sugar spikes?', 15, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

COMMIT;

