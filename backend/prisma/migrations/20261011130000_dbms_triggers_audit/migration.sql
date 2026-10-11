-- DBMS Review 3 — triggers and appointment status audit history.
--
-- The audit table is modelled in schema.prisma (AppointmentStatusAudit) so
-- Prisma Migrate sees no drift; its DDL below is exactly what
-- `prisma migrate diff` generates for that model. Trigger functions and
-- triggers are not represented in schema.prisma and are ignored by Prisma's
-- diff, so they live only in this migration.

-- CreateTable
CREATE TABLE "appointment_status_audit" (
    "id" BIGSERIAL NOT NULL,
    "appointmentId" UUID NOT NULL,
    "oldStatus" "AppointmentStatus" NOT NULL,
    "newStatus" "AppointmentStatus" NOT NULL,
    "changedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" VARCHAR(63) NOT NULL,

    CONSTRAINT "appointment_status_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_status_audit_appointmentId_changedAt_idx" ON "appointment_status_audit"("appointmentId", "changedAt");

-- AddForeignKey
-- ON DELETE CASCADE: appointments are never deleted by the application
-- (patients/doctors use RESTRICT), but the Jest fixtures delete their own test
-- appointments; CASCADE keeps that cleanup working. Trade-off: deleting an
-- appointment also deletes its audit history.
ALTER TABLE "appointment_status_audit" ADD CONSTRAINT "appointment_status_audit_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- Trigger A: keep queries.respondedAt consistent with queries.adminResponse.
--
-- BEFORE INSERT OR UPDATE, row level. Rules:
--   * A blank/whitespace-only response is stored as NULL.
--   * No response  -> respondedAt is NULL (a timestamp without a response is
--                     meaningless).
--   * INSERT with a response and no respondedAt -> respondedAt = now().
--     An explicitly supplied respondedAt is kept (seed/demo data).
--   * UPDATE that changes the response (set or edited) -> respondedAt = now().
--   * UPDATE that leaves the response unchanged -> respondedAt untouched.
-- It never changes "status" or "updatedAt": status transitions stay with the
-- caller (API or sp_respond_to_query) and updatedAt stays application-managed.
-- Only NEW is modified (BEFORE trigger), so it cannot recurse.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "trg_fn_queries_responded_at"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."adminResponse" := NULLIF(btrim(NEW."adminResponse"), '');

  IF NEW."adminResponse" IS NULL THEN
    NEW."respondedAt" := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    NEW."respondedAt" := COALESCE(NEW."respondedAt", now());
  ELSIF NEW."adminResponse" IS DISTINCT FROM OLD."adminResponse" THEN
    NEW."respondedAt" := now();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "trg_fn_queries_responded_at"() IS
  'BEFORE INSERT/UPDATE on queries: blank response -> NULL; no response -> respondedAt NULL; new or changed response -> respondedAt = now().';

CREATE TRIGGER "trg_queries_responded_at"
BEFORE INSERT OR UPDATE OF "adminResponse", "respondedAt" ON "queries"
FOR EACH ROW
EXECUTE FUNCTION "trg_fn_queries_responded_at"();

-- -----------------------------------------------------------------------------
-- Trigger B: audit appointment status changes.
--
-- AFTER UPDATE OF "status", row level, and only WHEN the value actually
-- changed (IS DISTINCT FROM), so re-saving the same status writes nothing.
-- Not fired on INSERT: the booking path stays untouched; a new appointment's
-- initial status is already on the appointment row itself.
-- Records old/new status, now() (transaction time) and session_user — the
-- database login role. With the shared application connection that is the app
-- role, NOT the person logged in to Express.
-- The audit row is written in the same transaction as the status change, so a
-- ROLLBACK removes both.
-- SECURITY DEFINER lets the audit row be written even when the role changing
-- the status has no INSERT privilege on the audit table (so the audit table
-- can be read-only for everyone else).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "trg_fn_appointments_status_audit"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO "appointment_status_audit" ("appointmentId", "oldStatus", "newStatus", "changedAt", "changedBy")
  VALUES (NEW."id", OLD."status", NEW."status", now(), session_user);
  RETURN NULL; -- AFTER trigger: return value is ignored
END;
$$;

COMMENT ON FUNCTION "trg_fn_appointments_status_audit"() IS
  'AFTER UPDATE OF status on appointments: inserts one appointment_status_audit row per real status change.';

REVOKE EXECUTE ON FUNCTION "trg_fn_appointments_status_audit"() FROM PUBLIC;

CREATE TRIGGER "trg_appointments_status_audit"
AFTER UPDATE OF "status" ON "appointments"
FOR EACH ROW
WHEN (OLD."status" IS DISTINCT FROM NEW."status")
EXECUTE FUNCTION "trg_fn_appointments_status_audit"();
