-- DBMS Review 2/3 — additive integrity constraints.
--
-- These rules were previously enforced only in application code (Zod schemas,
-- slot generation). Moving them into PostgreSQL protects the data from any
-- writer, not just the Express API. Prisma 5 cannot express CHECK constraints
-- in schema.prisma, so they live only in this migration; `prisma migrate diff`
-- ignores CHECK constraints and therefore reports no drift.
--
-- Existing rows were checked before writing this migration: zero violations
-- in the seed data or the Jest fixtures.

-- Feedback rating is optional; when present it is a 1–5 star score.
ALTER TABLE "feedback"
  ADD CONSTRAINT "feedback_rating_range_chk"
  CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);

-- dayOfWeek uses 0=Monday … 6=Sunday (backend/src/utils/dateTime.js getDayOfWeek).
ALTER TABLE "doctor_availability"
  ADD CONSTRAINT "doctor_availability_day_of_week_chk"
  CHECK ("dayOfWeek" BETWEEN 0 AND 6);

-- Times stay VARCHAR(5) 'HH:MM' (24-hour), matching the app's Zod regex.
-- Zero-padded HH:MM strings sort chronologically, so text comparison is valid
-- for the ordering checks below.
ALTER TABLE "doctor_availability"
  ADD CONSTRAINT "doctor_availability_time_format_chk"
  CHECK ("startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     AND "endTime"   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "doctor_availability"
  ADD CONSTRAINT "doctor_availability_time_order_chk"
  CHECK ("endTime" > "startTime");

ALTER TABLE "doctors"
  ADD CONSTRAINT "doctors_slot_duration_positive_chk"
  CHECK ("slotDurationMinutes" > 0);

-- NULL means "not recorded"; a CHECK that evaluates to UNKNOWN passes, but the
-- IS NULL branch is written out to make the intent explicit.
ALTER TABLE "doctors"
  ADD CONSTRAINT "doctors_experience_years_nonnegative_chk"
  CHECK ("experienceYears" IS NULL OR "experienceYears" >= 0);

ALTER TABLE "doctors"
  ADD CONSTRAINT "doctors_consultation_fee_nonnegative_chk"
  CHECK ("consultationFee" IS NULL OR "consultationFee" >= 0);

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_time_format_chk"
  CHECK ("startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     AND "endTime"   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_time_order_chk"
  CHECK ("endTime" > "startTime");
