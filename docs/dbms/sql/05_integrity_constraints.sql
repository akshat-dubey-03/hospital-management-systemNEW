-- =============================================================================
-- MediCore HMS — CHECK constraint demonstration (added after Review 1)
-- =============================================================================
-- Prerequisite: 01_ddl.sql (which includes the CHECK constraints) and 02_dml.sql
-- on a disposable database. Source migration:
--   backend/prisma/migrations/20261011100000_dbms_integrity_checks/migration.sql
--
-- Each rejection test is a DO block: the bad write must raise check_violation
-- (SQLSTATE 23514). If PostgreSQL accepts the row, the block raises a FAIL
-- exception instead, which stops psql under ON_ERROR_STOP. Nothing persists:
-- a failed statement inside a DO block rolls back, and the acceptance tests
-- run inside a transaction that ends in ROLLBACK.
-- =============================================================================

-- 0. List the CHECK constraints present.
SELECT conrelid::regclass AS table_name, conname AS constraint_name,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'c' AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, conname;

-- 1. feedback.rating must be 1–5.
DO $$
BEGIN
  INSERT INTO "feedback" ("patientId", "subject", "message", "rating")
  VALUES ('00000000-0000-4000-a000-000000000201', 'chk demo', 'rating 6', 6);
  RAISE EXCEPTION 'FAIL: rating 6 was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS rating=6 rejected: %', SQLERRM;
END $$;

-- 2. doctor_availability.dayOfWeek must be 0–6.
DO $$
BEGIN
  INSERT INTO "doctor_availability" ("doctorId", "dayOfWeek", "startTime", "endTime")
  VALUES ('00000000-0000-4000-a000-000000000301', 7, '09:00', '10:00');
  RAISE EXCEPTION 'FAIL: dayOfWeek 7 was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS dayOfWeek=7 rejected: %', SQLERRM;
END $$;

-- 3. Availability times must be valid 24-hour HH:MM.
DO $$
BEGIN
  INSERT INTO "doctor_availability" ("doctorId", "dayOfWeek", "startTime", "endTime")
  VALUES ('00000000-0000-4000-a000-000000000301', 5, '9:00', '25:00');
  RAISE EXCEPTION 'FAIL: malformed times were accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS malformed availability times rejected: %', SQLERRM;
END $$;

-- 4. Availability endTime must be after startTime.
DO $$
BEGIN
  INSERT INTO "doctor_availability" ("doctorId", "dayOfWeek", "startTime", "endTime")
  VALUES ('00000000-0000-4000-a000-000000000301', 5, '13:00', '09:00');
  RAISE EXCEPTION 'FAIL: end before start was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS availability end<start rejected: %', SQLERRM;
END $$;

-- 5. Doctor numeric rules: slot > 0, experience >= 0, fee >= 0.
DO $$
BEGIN
  UPDATE "doctors" SET "slotDurationMinutes" = 0
  WHERE "id" = '00000000-0000-4000-a000-000000000301';
  RAISE EXCEPTION 'FAIL: slotDurationMinutes 0 was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS slotDurationMinutes=0 rejected: %', SQLERRM;
END $$;

DO $$
BEGIN
  UPDATE "doctors" SET "experienceYears" = -1
  WHERE "id" = '00000000-0000-4000-a000-000000000301';
  RAISE EXCEPTION 'FAIL: negative experienceYears was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS experienceYears=-1 rejected: %', SQLERRM;
END $$;

DO $$
BEGIN
  UPDATE "doctors" SET "consultationFee" = -50.00
  WHERE "id" = '00000000-0000-4000-a000-000000000301';
  RAISE EXCEPTION 'FAIL: negative consultationFee was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS consultationFee=-50 rejected: %', SQLERRM;
END $$;

-- 6. Appointment times: valid format and end after start.
DO $$
BEGIN
  INSERT INTO "appointments" ("patientId", "doctorId", "appointmentDate",
                              "startTime", "endTime", "updatedAt")
  VALUES ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000301',
          DATE '2026-12-07', '10:30', '10:00', now());
  RAISE EXCEPTION 'FAIL: appointment end before start was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS appointment end<start rejected: %', SQLERRM;
END $$;

DO $$
BEGIN
  INSERT INTO "appointments" ("patientId", "doctorId", "appointmentDate",
                              "startTime", "endTime", "updatedAt")
  VALUES ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000301',
          DATE '2026-12-07', '10am', '10:30', now());
  RAISE EXCEPTION 'FAIL: appointment time 10am was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS appointment time 10am rejected: %', SQLERRM;
END $$;

-- 7. NULL handling: optional columns may stay NULL; boundary values are valid.
BEGIN;
INSERT INTO "feedback" ("patientId", "subject", "message", "rating")
VALUES ('00000000-0000-4000-a000-000000000201', 'chk demo', 'no rating given', NULL),
       ('00000000-0000-4000-a000-000000000201', 'chk demo', 'boundary 1', 1),
       ('00000000-0000-4000-a000-000000000201', 'chk demo', 'boundary 5', 5);
UPDATE "doctors" SET "experienceYears" = NULL, "consultationFee" = 0.00
WHERE "id" = '00000000-0000-4000-a000-000000000306';
SELECT "subject", "message", "rating" FROM "feedback" WHERE "subject" = 'chk demo' ORDER BY "message";
SELECT "lastName", "experienceYears", "consultationFee" FROM "doctors"
WHERE "id" = '00000000-0000-4000-a000-000000000306';
ROLLBACK;

-- 8. Nothing persisted.
SELECT COUNT(*) AS chk_demo_rows_left FROM "feedback" WHERE "subject" = 'chk demo';
