-- Final Review — ER entities MEDICAL_RECORD, PRESCRIPTION and BILL.
--
-- Purely additive: one new enum, three new tables, their keys/indexes, CHECK
-- constraints and one trigger. No existing table, column, constraint, view,
-- routine or trigger is altered or dropped, and no existing row is touched.
--
-- The CREATE TYPE / CREATE TABLE / CREATE INDEX / FOREIGN KEY statements are
-- written in the exact form `prisma migrate diff` emits for the models in
-- schema.prisma (MedicalRecord, Prescription, Bill, enum PaymentStatus), so
-- Prisma Migrate sees no drift. CHECK constraints and the trigger cannot be
-- expressed in schema.prisma; Prisma's diff ignores them (same approach as
-- 20261011100000_dbms_integrity_checks and 20261011130000_dbms_triggers_audit).
--
-- Cardinalities (ER diagram):
--   appointments 1 ── 0..1 medical_records   UNIQUE("appointmentId")
--   appointments 1 ── 0..1 bills             UNIQUE("appointmentId")
--   medical_records 1 ── N prescriptions     FK "medicalRecordId"
--   doctors 1 ── N medical_records           FK "doctorId"
--
-- Delete rules: RESTRICT from appointments/doctors (clinical and billing
-- history can never be removed by deleting a parent row); CASCADE from a
-- medical record to its prescription lines (weak entity).

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "medical_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "appointmentId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "treatmentNotes" TEXT,
    "recordDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "medicalRecordId" UUID NOT NULL,
    "medicineName" VARCHAR(200) NOT NULL,
    "dosage" VARCHAR(100) NOT NULL,
    "frequency" VARCHAR(100) NOT NULL,
    "duration" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "appointmentId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "billDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_appointmentId_key" ON "medical_records"("appointmentId");

-- CreateIndex
CREATE INDEX "medical_records_doctorId_idx" ON "medical_records"("doctorId");

-- CreateIndex
CREATE INDEX "prescriptions_medicalRecordId_idx" ON "prescriptions"("medicalRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "bills_appointmentId_key" ON "bills"("appointmentId");

-- CreateIndex
CREATE INDEX "bills_paymentStatus_idx" ON "bills"("paymentStatus");

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- CHECK constraints (not expressible in schema.prisma).
-- -----------------------------------------------------------------------------

-- A diagnosis must contain text, not just whitespace.
ALTER TABLE "medical_records"
  ADD CONSTRAINT "medical_records_diagnosis_not_blank_chk"
  CHECK (btrim("diagnosis") <> '');

-- Every prescription field is mandatory and non-blank.
ALTER TABLE "prescriptions"
  ADD CONSTRAINT "prescriptions_fields_not_blank_chk"
  CHECK (btrim("medicineName") <> ''
     AND btrim("dosage")       <> ''
     AND btrim("frequency")    <> ''
     AND btrim("duration")     <> '');

-- Money is never negative.
ALTER TABLE "bills"
  ADD CONSTRAINT "bills_amount_nonnegative_chk"
  CHECK ("amount" >= 0);

-- paidAt is recorded exactly when the bill is PAID.
ALTER TABLE "bills"
  ADD CONSTRAINT "bills_paid_at_consistent_chk"
  CHECK (("paymentStatus" = 'PAID') = ("paidAt" IS NOT NULL));

-- -----------------------------------------------------------------------------
-- Trigger: a medical record's doctor must be the appointment's doctor.
--
-- medical_records carries both "appointmentId" and "doctorId" (as in the ER
-- diagram). A plain FK cannot say "doctorId = appointments.doctorId for that
-- appointment", so this BEFORE INSERT/UPDATE row trigger rejects any mismatch
-- with SQLSTATE 23514 (check_violation). It only reads appointments and never
-- modifies other rows, so it cannot recurse.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "trg_fn_medical_records_doctor_match"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_doctor UUID;
BEGIN
  SELECT a."doctorId" INTO v_doctor
  FROM "appointments" AS a
  WHERE a."id" = NEW."appointmentId";

  -- A missing appointment is left to the foreign key to report.
  IF FOUND AND v_doctor IS DISTINCT FROM NEW."doctorId" THEN
    RAISE EXCEPTION 'medical record doctor % does not match appointment doctor %', NEW."doctorId", v_doctor
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "trg_fn_medical_records_doctor_match"() IS
  'BEFORE INSERT/UPDATE on medical_records: doctorId must equal the doctorId of the referenced appointment.';

CREATE TRIGGER "trg_medical_records_doctor_match"
BEFORE INSERT OR UPDATE OF "appointmentId", "doctorId" ON "medical_records"
FOR EACH ROW
EXECUTE FUNCTION "trg_fn_medical_records_doctor_match"();
