-- =============================================================================
-- MediCore HMS — Standalone DDL (current schema)
-- =============================================================================
-- Source of truth:
--   backend/prisma/schema.prisma
--   backend/prisma/migrations/20260830194500_appointment_workflow_foundation/migration.sql
--   backend/prisma/migrations/20261011100000_dbms_integrity_checks/migration.sql
--
-- Execute against a dedicated EMPTY development database only.
-- Do not run against the Prisma-managed application database (medicore_db).
--
-- This script does not DROP DATABASE, DROP TABLE, or truncate data.
-- Includes the CHECK constraints from the additive dbms_integrity_checks migration.
-- Views, routines, triggers and the audit table are created by 06-08.
-- Re-running on a database that already contains these types/tables will fail.
--
-- Identifiers are quoted to preserve Prisma camelCase column names.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUM types
-- -----------------------------------------------------------------------------

CREATE TYPE "Role" AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN');

CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

CREATE TYPE "AppointmentStatus" AS ENUM (
  'BOOKED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED_BY_PATIENT',
  'CANCELLED_BY_DOCTOR',
  'CANCELLED_BY_ADMIN'
);

CREATE TYPE "QueryStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- -----------------------------------------------------------------------------
-- Tables (parent → child order)
-- -----------------------------------------------------------------------------

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "patients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "dateOfBirth" DATE,
    "gender" "Gender",
    "phone" VARCHAR(20),
    "address" TEXT,
    "bloodGroup" VARCHAR(5),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doctors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "specialization" VARCHAR(200) NOT NULL,
    "qualification" VARCHAR(200) NOT NULL,
    "experienceYears" SMALLINT,
    "bio" TEXT,
    "phone" VARCHAR(20),
    "consultationFee" DECIMAL(10, 2),
    "slotDurationMinutes" SMALLINT NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doctor_availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "doctorId" UUID NOT NULL,
    "dayOfWeek" SMALLINT NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "doctor_availability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "appointments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "appointmentDate" DATE NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "reasonForVisit" TEXT,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "rating" SMALLINT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "queries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "QueryStatus" NOT NULL DEFAULT 'OPEN',
    "adminResponse" TEXT,
    "respondedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "queries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patientId" UUID NOT NULL,
    "title" VARCHAR(200),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversationId" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------------------------------------------
-- Unique indexes
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE UNIQUE INDEX "patients_userId_key" ON "patients"("userId");

CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

CREATE UNIQUE INDEX "doctors_userId_key" ON "doctors"("userId");

CREATE UNIQUE INDEX "doctor_availability_doctorId_dayOfWeek_startTime_key"
  ON "doctor_availability"("doctorId", "dayOfWeek", "startTime");

-- -----------------------------------------------------------------------------
-- Non-unique indexes
-- -----------------------------------------------------------------------------

CREATE INDEX "appointments_patientId_idx" ON "appointments"("patientId");

CREATE INDEX "appointments_doctorId_idx" ON "appointments"("doctorId");

CREATE INDEX "appointments_appointmentDate_idx" ON "appointments"("appointmentDate");

CREATE INDEX "appointments_doctorId_appointmentDate_idx"
  ON "appointments"("doctorId", "appointmentDate");

CREATE INDEX "feedback_patientId_idx" ON "feedback"("patientId");

CREATE INDEX "queries_patientId_idx" ON "queries"("patientId");

CREATE INDEX "chat_conversations_patientId_idx" ON "chat_conversations"("patientId");

CREATE INDEX "chat_messages_conversationId_createdAt_idx"
  ON "chat_messages"("conversationId", "createdAt");

-- -----------------------------------------------------------------------------
-- Foreign keys (ON DELETE / ON UPDATE match the Prisma foundation migration)
-- -----------------------------------------------------------------------------

ALTER TABLE "patients"
  ADD CONSTRAINT "patients_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "doctors"
  ADD CONSTRAINT "doctors_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "doctors"
  ADD CONSTRAINT "doctors_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "doctor_availability"
  ADD CONSTRAINT "doctor_availability_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "doctors"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "doctors"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "feedback"
  ADD CONSTRAINT "feedback_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "queries"
  ADD CONSTRAINT "queries_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- Partial unique index: active appointment slots only
-- Do not replace this with a full UNIQUE on (doctorId, appointmentDate, startTime).
-- Cancelled appointments must remain allowed to occupy the same slot key.
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "appointments_active_doctor_slot_unique"
ON "appointments" ("doctorId", "appointmentDate", "startTime")
WHERE "status" NOT IN (
  'CANCELLED_BY_PATIENT',
  'CANCELLED_BY_DOCTOR',
  'CANCELLED_BY_ADMIN'
);

-- -----------------------------------------------------------------------------
-- CHECK constraints — added after Review 1
-- Source: backend/prisma/migrations/20261011100000_dbms_integrity_checks
-- Rules previously enforced only by application code (Zod / slot generation).
-- Times remain VARCHAR(5) 'HH:MM'; zero-padded strings compare chronologically.
-- -----------------------------------------------------------------------------
ALTER TABLE "feedback"
  ADD CONSTRAINT "feedback_rating_range_chk"
  CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);

ALTER TABLE "doctor_availability"
  ADD CONSTRAINT "doctor_availability_day_of_week_chk"
  CHECK ("dayOfWeek" BETWEEN 0 AND 6);

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
