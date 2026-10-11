-- =============================================================================
-- MediCore HMS — Stored procedures and user-defined functions (Review 3)
-- =============================================================================
-- Part 1 is byte-for-byte the migration
--   backend/prisma/migrations/20261011120000_dbms_routines/migration.sql
-- Part 2 demonstrates valid calls, every documented error, repeated calls and
-- rollback, against the 02_dml.sql demo data.
-- Run on a disposable database after 01_ddl.sql and 02_dml.sql.
-- =============================================================================

-- ---------------------------- Part 1: definitions ----------------------------
-- DBMS Review 3 — stored procedures and user-defined functions.
--
-- Demonstration routines; the Express/Prisma application does NOT call them,
-- and they do not replace any API path. They apply the same business rules as
-- the API (appointments.routes.js) so SQL-level callers cannot bypass them.
--
-- Transactions: none of these routines COMMITs or ROLLBACKs. The caller owns
-- the transaction, so a CALL inside BEGIN ... ROLLBACK is fully undone.
--
-- Error contract (SQLSTATE):
--   22004 null_value_not_allowed            a required argument is NULL
--   22023 invalid_parameter_value           argument outside the allowed set
--   P0002 no_data_found                     the referenced row does not exist
--   55000 object_not_in_prerequisite_state  the row's current state forbids it

-- -----------------------------------------------------------------------------
-- Procedure 1: cancel an appointment.
--   p_cancel_status  one of the three CANCELLED_* statuses (who cancelled).
--   p_as_of          clock used for the "already started" rule; defaults to
--                    now(), overridable so tests are deterministic.
-- Rules mirrored from the API: only BOOKED/CONFIRMED can be cancelled, and not
-- once the appointment has started. Cancelling an already-cancelled
-- appointment is refused (not silently repeated).
-- Concurrency: SELECT ... FOR UPDATE locks the row, so two concurrent cancels
-- (or a cancel racing a status change) serialise; the second sees the new
-- status and is refused.
-- SECURITY DEFINER: runs with the owner's rights so a role may be allowed to
-- cancel through this procedure without UPDATE on the table (see the security
-- phase). search_path is pinned to avoid object-hijacking via a caller's path.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE "sp_cancel_appointment"(
  p_appointment_id UUID,
  p_cancel_status  "AppointmentStatus",
  p_reason         TEXT DEFAULT NULL,
  p_as_of          TIMESTAMPTZ DEFAULT now()
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status "AppointmentStatus";
  v_starts TIMESTAMPTZ;
BEGIN
  IF p_appointment_id IS NULL OR p_cancel_status IS NULL THEN
    RAISE EXCEPTION 'appointment id and cancel status are required'
      USING ERRCODE = 'null_value_not_allowed';
  END IF;

  IF p_cancel_status NOT IN ('CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR', 'CANCELLED_BY_ADMIN') THEN
    RAISE EXCEPTION 'status % is not a cancellation status', p_cancel_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT a."status", (a."appointmentDate" + a."startTime"::TIME) AT TIME ZONE 'UTC'
    INTO v_status, v_starts
  FROM "appointments" AS a
  WHERE a."id" = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment % not found', p_appointment_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_status NOT IN ('BOOKED', 'CONFIRMED') THEN
    RAISE EXCEPTION 'appointment % is % and cannot be cancelled', p_appointment_id, v_status
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_starts <= p_as_of THEN
    RAISE EXCEPTION 'appointment % started at % and can no longer be cancelled', p_appointment_id, v_starts
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  -- updatedAt is set explicitly: Prisma's @updatedAt is client-side only and
  -- is not a database default.
  UPDATE "appointments"
  SET "status"             = p_cancel_status,
      "cancellationReason" = NULLIF(btrim(p_reason), ''),
      "cancelledAt"        = now(),
      "updatedAt"          = now()
  WHERE "id" = p_appointment_id;
END;
$$;

COMMENT ON PROCEDURE "sp_cancel_appointment"(UUID, "AppointmentStatus", TEXT, TIMESTAMPTZ) IS
  'Cancel a BOOKED/CONFIRMED appointment that has not started. Locks the row; sets status, cancellationReason, cancelledAt, updatedAt. Caller controls the transaction.';

-- -----------------------------------------------------------------------------
-- Procedure 2: respond to / progress a patient support query.
--   p_status    IN_PROGRESS, RESOLVED or CLOSED (moving back to OPEN is not
--               allowed through this procedure).
--   p_response  admin response text; required (non-blank) for RESOLVED.
-- Rules: a CLOSED query is terminal and cannot be changed. When a response is
-- given, adminResponse and respondedAt are set; when NULL, the existing
-- response is kept.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE "sp_respond_to_query"(
  p_query_id UUID,
  p_status   "QueryStatus",
  p_response TEXT DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status   "QueryStatus";
  v_response TEXT := NULLIF(btrim(p_response), '');
BEGIN
  IF p_query_id IS NULL OR p_status IS NULL THEN
    RAISE EXCEPTION 'query id and status are required'
      USING ERRCODE = 'null_value_not_allowed';
  END IF;

  IF p_status = 'OPEN' THEN
    RAISE EXCEPTION 'a query cannot be moved back to OPEN'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_status = 'RESOLVED' AND v_response IS NULL THEN
    RAISE EXCEPTION 'a response is required to resolve a query'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT q."status" INTO v_status
  FROM "queries" AS q
  WHERE q."id" = p_query_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'query % not found', p_query_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_status = 'CLOSED' THEN
    RAISE EXCEPTION 'query % is CLOSED and cannot be changed', p_query_id
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  UPDATE "queries"
  SET "status"        = p_status,
      "adminResponse" = COALESCE(v_response, "adminResponse"),
      "respondedAt"   = CASE WHEN v_response IS NOT NULL THEN now() ELSE "respondedAt" END,
      "updatedAt"     = now()
  WHERE "id" = p_query_id;
END;
$$;

COMMENT ON PROCEDURE "sp_respond_to_query"(UUID, "QueryStatus", TEXT) IS
  'Move a support query to IN_PROGRESS/RESOLVED/CLOSED with an optional response (required for RESOLVED). CLOSED is terminal. Caller controls the transaction.';

-- -----------------------------------------------------------------------------
-- Function 1: completed appointments for a doctor.
-- STABLE (reads only, same result within one statement), so it is safe in
-- SELECT lists and WHERE clauses. Returns NULL for an unknown doctor id so
-- "no such doctor" is distinguishable from "0 completed".
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "fn_doctor_completed_count"(p_doctor_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
           WHEN NOT EXISTS (SELECT 1 FROM "doctors" WHERE "id" = p_doctor_id) THEN NULL
           ELSE (SELECT COUNT(*)::INTEGER FROM "appointments"
                 WHERE "doctorId" = p_doctor_id AND "status" = 'COMPLETED')
         END;
$$;

COMMENT ON FUNCTION "fn_doctor_completed_count"(UUID) IS
  'Number of COMPLETED appointments for a doctor; NULL if the doctor does not exist. Read-only (STABLE).';

-- -----------------------------------------------------------------------------
-- Function 2: a patient's upcoming active appointments on/after a date.
-- p_as_of defaults to CURRENT_DATE; pass a fixed date for reproducible output.
-- Counts BOOKED and CONFIRMED only. NULL for an unknown patient id.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "fn_patient_upcoming_count"(
  p_patient_id UUID,
  p_as_of      DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
           WHEN NOT EXISTS (SELECT 1 FROM "patients" WHERE "id" = p_patient_id) THEN NULL
           ELSE (SELECT COUNT(*)::INTEGER FROM "appointments"
                 WHERE "patientId" = p_patient_id
                   AND "status" IN ('BOOKED', 'CONFIRMED')
                   AND "appointmentDate" >= p_as_of)
         END;
$$;

COMMENT ON FUNCTION "fn_patient_upcoming_count"(UUID, DATE) IS
  'Number of BOOKED/CONFIRMED appointments for a patient on or after p_as_of (default today); NULL if the patient does not exist. Read-only (STABLE).';

-- SECURITY DEFINER procedures must not be callable by every role: PostgreSQL
-- grants EXECUTE to PUBLIC by default. The owner (the role that runs the
-- migrations, i.e. the application user) keeps full rights, so application
-- behaviour is unchanged. Specific roles are granted EXECUTE in the security
-- phase.
REVOKE EXECUTE ON PROCEDURE "sp_cancel_appointment"(UUID, "AppointmentStatus", TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON PROCEDURE "sp_respond_to_query"(UUID, "QueryStatus", TEXT) FROM PUBLIC;

-- =============================================================================
-- DEMONSTRATION AND TESTS (not part of the migration)
-- Requires 02_dml.sql demo data. Every state change below is either rolled
-- back explicitly or happens inside a statement that fails, so the demo data
-- is unchanged afterwards (checked at the end).
-- Negative tests are DO blocks: the expected SQLSTATE prints PASS; any other
-- outcome raises FAIL and stops psql (ON_ERROR_STOP).
-- =============================================================================

-- R-0  Signatures, kinds, volatility and security mode.
SELECT p.proname AS routine,
       CASE p.prokind WHEN 'p' THEN 'procedure' WHEN 'f' THEN 'function' END AS kind,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       CASE p.provolatile WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' WHEN 'i' THEN 'IMMUTABLE' END AS volatility,
       p.prosecdef AS security_definer,
       p.proacl AS acl
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.proname ~ '^(sp|fn)_'
ORDER BY kind DESC, routine;

-- ---------------------------------------------------------------- functions --
-- F-1  fn_doctor_completed_count in a SELECT list, cross-checked against a
--      direct aggregate.
SELECT d."lastName",
       fn_doctor_completed_count(d."id") AS fn_completed,
       (SELECT COUNT(*) FROM "appointments" a
        WHERE a."doctorId" = d."id" AND a."status" = 'COMPLETED') AS direct_count
FROM "doctors" d
ORDER BY d."lastName";

-- F-1  Unknown doctor id -> NULL (not 0).
SELECT fn_doctor_completed_count('00000000-0000-4000-a000-00000000ffff') AS unknown_doctor;

-- F-2  fn_patient_upcoming_count with a fixed as-of date (reproducible).
SELECT p."lastName",
       fn_patient_upcoming_count(p."id", DATE '2026-10-01') AS upcoming_from_oct_1,
       fn_patient_upcoming_count(p."id", DATE '2026-10-16') AS upcoming_from_oct_16
FROM "patients" p
ORDER BY p."lastName";

-- F-2  In a WHERE clause: patients with 2+ upcoming visits from 2026-10-01.
SELECT p."firstName", p."lastName"
FROM "patients" p
WHERE fn_patient_upcoming_count(p."id", DATE '2026-10-01') >= 2
ORDER BY p."lastName";

-- F-2  Unknown patient id -> NULL.
SELECT fn_patient_upcoming_count('00000000-0000-4000-a000-00000000ffff', DATE '2026-10-01') AS unknown_patient;

-- --------------------------------------------------- sp_cancel_appointment --
-- P1-1  Valid cancel of BOOKED appointment 510 (2026-10-15 10:00), as of
--       2026-10-10, then ROLLBACK. Shows every column the procedure sets.
BEGIN;
SELECT "status", "cancellationReason", "cancelledAt", "updatedAt"
FROM "appointments" WHERE "id" = '00000000-0000-4000-a000-000000000510';
CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000510',
                           'CANCELLED_BY_PATIENT', '  Travelling that week  ',
                           TIMESTAMPTZ '2026-10-10 09:00+00');
SELECT "status", "cancellationReason", "cancelledAt" IS NOT NULL AS cancelled_at_set,
       "updatedAt" = now() AS updated_at_is_txn_time
FROM "appointments" WHERE "id" = '00000000-0000-4000-a000-000000000510';

-- P1-2  Repeated call on the now-cancelled appointment is refused.
DO $$
BEGIN
  CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000510',
                             'CANCELLED_BY_PATIENT', NULL, TIMESTAMPTZ '2026-10-10 09:00+00');
  RAISE EXCEPTION 'FAIL: second cancel was accepted';
EXCEPTION WHEN object_not_in_prerequisite_state THEN
  RAISE NOTICE 'PASS repeated cancel refused: %', SQLERRM;
END $$;

-- P1-3  The freed slot can be rebooked (partial unique index ignores cancelled rows).
INSERT INTO "appointments" ("patientId", "doctorId", "appointmentDate", "startTime", "endTime", "status", "updatedAt")
VALUES ('00000000-0000-4000-a000-000000000203', '00000000-0000-4000-a000-000000000301',
        DATE '2026-10-15', '10:00', '10:30', 'BOOKED', now());
SELECT COUNT(*) AS rows_in_slot,
       COUNT(*) FILTER (WHERE "status" IN ('BOOKED', 'CONFIRMED')) AS active_rows_in_slot
FROM "appointments"
WHERE "doctorId" = '00000000-0000-4000-a000-000000000301'
  AND "appointmentDate" = DATE '2026-10-15' AND "startTime" = '10:00';
ROLLBACK;

-- P1-4  After ROLLBACK the appointment is BOOKED again and the rebooking is gone.
SELECT "status", "cancellationReason", "cancelledAt"
FROM "appointments" WHERE "id" = '00000000-0000-4000-a000-000000000510';

-- P1-5  Completed appointment cannot be cancelled.
DO $$
BEGIN
  CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000501',
                             'CANCELLED_BY_ADMIN', NULL, TIMESTAMPTZ '2026-10-10 09:00+00');
  RAISE EXCEPTION 'FAIL: completed appointment was cancelled';
EXCEPTION WHEN object_not_in_prerequisite_state THEN
  RAISE NOTICE 'PASS completed appointment refused: %', SQLERRM;
END $$;

-- P1-6  Appointment that already started (508, 2026-10-07 09:00) cannot be cancelled.
DO $$
BEGIN
  CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000508',
                             'CANCELLED_BY_DOCTOR', NULL, TIMESTAMPTZ '2026-10-10 09:00+00');
  RAISE EXCEPTION 'FAIL: started appointment was cancelled';
EXCEPTION WHEN object_not_in_prerequisite_state THEN
  RAISE NOTICE 'PASS started appointment refused: %', SQLERRM;
END $$;

-- P1-7  Unknown appointment id.
DO $$
BEGIN
  CALL sp_cancel_appointment('00000000-0000-4000-a000-00000000ffff', 'CANCELLED_BY_ADMIN');
  RAISE EXCEPTION 'FAIL: unknown id accepted';
EXCEPTION WHEN no_data_found THEN
  RAISE NOTICE 'PASS unknown appointment: %', SQLERRM;
END $$;

-- P1-8  A non-cancellation status is rejected.
DO $$
BEGIN
  CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000510', 'COMPLETED');
  RAISE EXCEPTION 'FAIL: COMPLETED accepted as cancel status';
EXCEPTION WHEN invalid_parameter_value THEN
  RAISE NOTICE 'PASS invalid cancel status: %', SQLERRM;
END $$;

-- P1-9  NULL id is rejected.
DO $$
BEGIN
  CALL sp_cancel_appointment(NULL, 'CANCELLED_BY_ADMIN');
  RAISE EXCEPTION 'FAIL: NULL id accepted';
EXCEPTION WHEN null_value_not_allowed THEN
  RAISE NOTICE 'PASS NULL id: %', SQLERRM;
END $$;

-- ----------------------------------------------------- sp_respond_to_query --
-- P2-1  Resolve OPEN query 702 with a response, then ROLLBACK.
BEGIN;
CALL sp_respond_to_query('00000000-0000-4000-a000-000000000702', 'RESOLVED',
                         'Saturday clinics are not offered; weekday slots are open.');
SELECT "status", "adminResponse", "respondedAt" IS NOT NULL AS responded_at_set
FROM "queries" WHERE "id" = '00000000-0000-4000-a000-000000000702';
ROLLBACK;

-- P2-2  IN_PROGRESS without a response keeps response/respondedAt unchanged (NULL).
BEGIN;
CALL sp_respond_to_query('00000000-0000-4000-a000-000000000705', 'IN_PROGRESS');
SELECT "status", "adminResponse", "respondedAt"
FROM "queries" WHERE "id" = '00000000-0000-4000-a000-000000000705';
ROLLBACK;

-- P2-3  RESOLVED requires a non-blank response.
DO $$
BEGIN
  CALL sp_respond_to_query('00000000-0000-4000-a000-000000000702', 'RESOLVED', '   ');
  RAISE EXCEPTION 'FAIL: blank response accepted for RESOLVED';
EXCEPTION WHEN invalid_parameter_value THEN
  RAISE NOTICE 'PASS RESOLVED without response: %', SQLERRM;
END $$;

-- P2-4  Moving back to OPEN is rejected.
DO $$
BEGIN
  CALL sp_respond_to_query('00000000-0000-4000-a000-000000000703', 'OPEN');
  RAISE EXCEPTION 'FAIL: OPEN accepted';
EXCEPTION WHEN invalid_parameter_value THEN
  RAISE NOTICE 'PASS back to OPEN: %', SQLERRM;
END $$;

-- P2-5  CLOSED query (704) is terminal.
DO $$
BEGIN
  CALL sp_respond_to_query('00000000-0000-4000-a000-000000000704', 'RESOLVED', 'Reopening');
  RAISE EXCEPTION 'FAIL: CLOSED query changed';
EXCEPTION WHEN object_not_in_prerequisite_state THEN
  RAISE NOTICE 'PASS CLOSED is terminal: %', SQLERRM;
END $$;

-- P2-6  Unknown query id.
DO $$
BEGIN
  CALL sp_respond_to_query('00000000-0000-4000-a000-00000000ffff', 'CLOSED');
  RAISE EXCEPTION 'FAIL: unknown query accepted';
EXCEPTION WHEN no_data_found THEN
  RAISE NOTICE 'PASS unknown query: %', SQLERRM;
END $$;

-- R-9  Demo data unchanged after all of the above.
SELECT (SELECT "status" FROM "appointments" WHERE "id" = '00000000-0000-4000-a000-000000000510') AS appt_510,
       (SELECT "status" FROM "queries" WHERE "id" = '00000000-0000-4000-a000-000000000702') AS query_702,
       (SELECT "status" FROM "queries" WHERE "id" = '00000000-0000-4000-a000-000000000705') AS query_705,
       (SELECT COUNT(*) FROM "appointments") AS appointment_rows;
