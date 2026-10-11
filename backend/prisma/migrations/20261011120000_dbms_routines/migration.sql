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
