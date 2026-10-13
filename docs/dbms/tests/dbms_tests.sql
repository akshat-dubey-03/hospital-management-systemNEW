-- =============================================================================
-- MediCore HMS — DBMS test suite (SQL assertion cases)
-- =============================================================================
-- Run through docs/dbms/run_dbms_tests.sh, which builds a fresh disposable
-- database (01, 02, 06, 07, 08, 10, 12) and then runs this file as postgres.
--
-- Conventions
--   * Every case records PASS/FAIL in pg_temp.test_results; a failing case does
--     not stop the others. The summary at the end raises an error if anything
--     failed, so psql exits non-zero.
--   * Cases that write data finish with RAISE ... USING ERRCODE = 'P0099'
--     ('undo'), caught locally: the PL/pgSQL block is a subtransaction, so
--     every write in it is rolled back. Nothing persists.
--   * Expected errors are caught by their exact SQLSTATE only; any other error
--     propagates to the case handler and is recorded as FAIL with its message.
-- =============================================================================

\set ON_ERROR_STOP on

-- Guard: refuse to run anywhere but a dedicated medicore_dbms_* database.
DO $$
BEGIN
  IF current_database() !~ '^medicore_dbms_[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'refusing to run DBMS tests in database "%"', current_database();
  END IF;
END $$;

CREATE TEMP TABLE test_results (
  case_id     TEXT PRIMARY KEY,
  area        TEXT NOT NULL,
  description TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL')),
  detail      TEXT
);

-- assert(condition, message): raise when the condition is not exactly TRUE.
CREATE FUNCTION pg_temp.assert(ok BOOLEAN, msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN
    RAISE EXCEPTION 'assertion failed: %', msg;
  END IF;
END $$;

-- record(id, area, description, status, detail)
CREATE FUNCTION pg_temp.record(id TEXT, area TEXT, descr TEXT, st TEXT, detail TEXT DEFAULT NULL) RETURNS VOID
LANGUAGE sql AS $$
  INSERT INTO pg_temp.test_results VALUES (id, area, descr, st, detail);
$$;

-- -----------------------------------------------------------------------------
-- T01  DDL / object presence
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'tables, enums, FKs, CHECKs, views, routines, triggers and the partial unique index exist';
BEGIN
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') = 11, '11 tables');
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                          WHERE n.nspname = 'public' AND t.typtype = 'e') = 5, '5 enums');
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype = 'f') = 11, '11 FKs');
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype = 'c') = 9, '9 CHECKs');
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM pg_views WHERE schemaname = 'public' AND viewname LIKE 'vw_dbms_%') = 3, '3 views');
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname ~ '^(sp|fn)_') = 4, '4 routines');
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM pg_trigger WHERE NOT tgisinternal) = 2, '2 triggers');
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'appointments_active_doctor_slot_unique'
                                 AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%WHERE%'), 'partial unique index');
  PERFORM pg_temp.record('T01', 'DDL', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T01', 'DDL', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T02  Primary key rejection
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'duplicate primary key is rejected (unique_violation on users_pkey)';
BEGIN
  BEGIN
    INSERT INTO "users" ("id", "email", "passwordHash", "role", "updatedAt")
    VALUES ('00000000-0000-4000-a000-000000000001', 'other@medicore.dbms.example', 'x', 'ADMIN', now());
    RAISE EXCEPTION 'duplicate id accepted';
  EXCEPTION WHEN unique_violation THEN
    PERFORM pg_temp.assert(SQLERRM LIKE '%users_pkey%', 'violation names users_pkey');
  END;
  PERFORM pg_temp.record('T02', 'Keys', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T02', 'Keys', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T03  Foreign key rejection
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'appointment referencing a non-existent patient is rejected (foreign_key_violation)';
BEGIN
  BEGIN
    INSERT INTO "appointments" ("patientId", "doctorId", "appointmentDate", "startTime", "endTime", "updatedAt")
    VALUES ('00000000-0000-4000-a000-00000000ffff', '00000000-0000-4000-a000-000000000301',
            DATE '2026-12-07', '09:00', '09:30', now());
    RAISE EXCEPTION 'orphan appointment accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  PERFORM pg_temp.record('T03', 'Keys', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T03', 'Keys', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T04  CHECK constraints and NULL behaviour
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'rating 0 and end<start rejected by CHECK; NULL rating and boundary values accepted';
BEGIN
  BEGIN
    INSERT INTO "feedback" ("patientId", "subject", "message", "rating")
    VALUES ('00000000-0000-4000-a000-000000000201', 'T04', 'x', 0);
    RAISE EXCEPTION 'rating 0 accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE "doctor_availability" SET "endTime" = '08:00' WHERE "id" = '00000000-0000-4000-a000-000000000401';
    RAISE EXCEPTION 'availability end<start accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "feedback" ("patientId", "subject", "message", "rating") VALUES
      ('00000000-0000-4000-a000-000000000201', 'T04', 'null', NULL),
      ('00000000-0000-4000-a000-000000000201', 'T04', 'one', 1),
      ('00000000-0000-4000-a000-000000000201', 'T04', 'five', 5);
    PERFORM pg_temp.assert((SELECT COUNT(*) FROM "feedback" WHERE "subject" = 'T04') = 3, '3 valid rows inserted');
    RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'undo';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
  END;
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM "feedback" WHERE "subject" = 'T04') = 0, 'undo removed rows');
  PERFORM pg_temp.record('T04', 'Constraints', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T04', 'Constraints', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T05  ON DELETE behaviour (RESTRICT and CASCADE)
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'deleting a patient with appointments is RESTRICTed; deleting a conversation CASCADEs to its messages';
BEGIN
  BEGIN
    DELETE FROM "patients" WHERE "id" = '00000000-0000-4000-a000-000000000201';
    RAISE EXCEPTION 'patient with appointments deleted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    PERFORM pg_temp.assert((SELECT COUNT(*) FROM "chat_messages" WHERE "conversationId" = '00000000-0000-4000-a000-000000000801') = 4, '4 messages before');
    DELETE FROM "chat_conversations" WHERE "id" = '00000000-0000-4000-a000-000000000801';
    PERFORM pg_temp.assert((SELECT COUNT(*) FROM "chat_messages" WHERE "conversationId" = '00000000-0000-4000-a000-000000000801') = 0, 'messages cascaded');
    RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'undo';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
  END;
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM "chat_messages" WHERE "conversationId" = '00000000-0000-4000-a000-000000000801') = 4, 'messages restored');
  PERFORM pg_temp.record('T05', 'Constraints', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T05', 'Constraints', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T06  Partial unique index
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'second ACTIVE booking of a slot is rejected; a CANCELLED slot can be rebooked';
BEGIN
  BEGIN
    -- 510: Sharma 2026-10-15 10:00 BOOKED (active)
    INSERT INTO "appointments" ("patientId", "doctorId", "appointmentDate", "startTime", "endTime", "updatedAt")
    VALUES ('00000000-0000-4000-a000-000000000203', '00000000-0000-4000-a000-000000000301',
            DATE '2026-10-15', '10:00', '10:30', now());
    RAISE EXCEPTION 'duplicate active slot accepted';
  EXCEPTION WHEN unique_violation THEN
    PERFORM pg_temp.assert(SQLERRM LIKE '%appointments_active_doctor_slot_unique%', 'violation names the partial index');
  END;
  BEGIN
    -- 506: Sharma 2026-09-14 09:00 CANCELLED_BY_DOCTOR
    INSERT INTO "appointments" ("patientId", "doctorId", "appointmentDate", "startTime", "endTime", "updatedAt")
    VALUES ('00000000-0000-4000-a000-000000000203', '00000000-0000-4000-a000-000000000301',
            DATE '2026-09-14', '09:00', '09:30', now());
    RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'undo';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
  END;
  PERFORM pg_temp.record('T06', 'Constraints', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T06', 'Constraints', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T07  Representative query results (demo rows only)
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'status counts of the 15 demo appointments; CQ-04 returns only Kumar; BQ-C05 pairs Kumar-Nair';
BEGIN
  PERFORM pg_temp.assert((SELECT string_agg(s || '=' || c, ',' ORDER BY s) FROM (
      SELECT "status"::TEXT AS s, COUNT(*) AS c FROM "appointments"
      WHERE "id"::TEXT LIKE '00000000-0000-4000-a000-%' GROUP BY 1) x)
    = 'BOOKED=5,CANCELLED_BY_ADMIN=1,CANCELLED_BY_DOCTOR=1,CANCELLED_BY_PATIENT=1,COMPLETED=4,CONFIRMED=3',
    'status distribution');
  -- CQ-04 core: unread feedback INTERSECT active query
  PERFORM pg_temp.assert((SELECT string_agg(p."lastName", ',') FROM "patients" p WHERE p."id" IN (
      SELECT "patientId" FROM "feedback" WHERE "isRead" = FALSE
      INTERSECT SELECT "patientId" FROM "queries" WHERE "status" IN ('OPEN', 'IN_PROGRESS'))) = 'Kumar', 'CQ-04');
  -- BQ-C05 self join
  PERFORM pg_temp.assert((SELECT string_agg(p1."lastName" || '-' || p2."lastName", ',')
      FROM "patients" p1 JOIN "patients" p2 ON p1."bloodGroup" = p2."bloodGroup" AND p1."id" < p2."id"
      WHERE p1."id"::TEXT LIKE '00000000-0000-4000-a000-%' AND p2."id"::TEXT LIKE '00000000-0000-4000-a000-%') = 'Kumar-Nair', 'BQ-C05');
  PERFORM pg_temp.record('T07', 'Queries', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T07', 'Queries', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T08  View correctness vs base tables
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'detail view = 4-table join (0 mismatches); stats view totals = GROUP BY; directory hides inactive doctor';
BEGIN
  PERFORM pg_temp.assert((
    SELECT COUNT(*) FROM (
      (SELECT a."id" FROM "appointments" a JOIN "patients" p ON p."id" = a."patientId"
         JOIN "doctors" d ON d."id" = a."doctorId" JOIN "departments" dep ON dep."id" = d."departmentId"
       EXCEPT SELECT appointment_id FROM "vw_dbms_appointment_details")
      UNION ALL
      (SELECT appointment_id FROM "vw_dbms_appointment_details" EXCEPT SELECT "id" FROM "appointments")) x) = 0,
    'detail view symmetric difference');
  PERFORM pg_temp.assert(NOT EXISTS (
    SELECT 1 FROM "vw_dbms_doctor_appointment_stats" s
    WHERE s.total_appointments <> (SELECT COUNT(*) FROM "appointments" a WHERE a."doctorId" = s.doctor_id)),
    'stats totals');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM "vw_dbms_public_doctor_directory"
                                     WHERE doctor_id = '00000000-0000-4000-a000-000000000305'), 'inactive Gupta hidden');
  PERFORM pg_temp.record('T08', 'Views', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T08', 'Views', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T09  Function correctness
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'fn_doctor_completed_count(Sharma)=2, unknown=NULL; fn_patient_upcoming_count(Kumar, 2026-10-01)=2, unknown=NULL';
BEGIN
  PERFORM pg_temp.assert(fn_doctor_completed_count('00000000-0000-4000-a000-000000000301') = 2, 'Sharma completed');
  PERFORM pg_temp.assert(fn_doctor_completed_count('00000000-0000-4000-a000-00000000ffff') IS NULL, 'unknown doctor');
  PERFORM pg_temp.assert(fn_patient_upcoming_count('00000000-0000-4000-a000-000000000201', DATE '2026-10-01') = 2, 'Kumar upcoming');
  PERFORM pg_temp.assert(fn_patient_upcoming_count('00000000-0000-4000-a000-00000000ffff', DATE '2026-10-01') IS NULL, 'unknown patient');
  PERFORM pg_temp.record('T09', 'Functions', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T09', 'Functions', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T10  Procedure: valid call
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'sp_cancel_appointment sets status, trimmed reason, cancelledAt and updatedAt; sp_respond_to_query resolves with respondedAt';
BEGIN
  BEGIN
    CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000510', 'CANCELLED_BY_PATIENT', '  reason  ', TIMESTAMPTZ '2026-10-10 09:00+00');
    PERFORM pg_temp.assert((SELECT "status" = 'CANCELLED_BY_PATIENT' AND "cancellationReason" = 'reason'
                                   AND "cancelledAt" IS NOT NULL AND "updatedAt" = now()
                            FROM "appointments" WHERE "id" = '00000000-0000-4000-a000-000000000510'), 'appointment cancelled');
    CALL sp_respond_to_query('00000000-0000-4000-a000-000000000702', 'RESOLVED', 'Answer');
    PERFORM pg_temp.assert((SELECT "status" = 'RESOLVED' AND "respondedAt" IS NOT NULL
                            FROM "queries" WHERE "id" = '00000000-0000-4000-a000-000000000702'), 'query resolved');
    RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'undo';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
  END;
  PERFORM pg_temp.record('T10', 'Procedures', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T10', 'Procedures', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T11  Procedure: invalid arguments and state transitions
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'completed/started appointment (55000), unknown id (P0002), non-cancel status (22023), CLOSED query (55000) are refused';
BEGIN
  BEGIN CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000501', 'CANCELLED_BY_ADMIN', NULL, TIMESTAMPTZ '2026-10-10 09:00+00');
        RAISE EXCEPTION 'completed cancelled';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
  BEGIN CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000508', 'CANCELLED_BY_ADMIN', NULL, TIMESTAMPTZ '2026-10-10 09:00+00');
        RAISE EXCEPTION 'started cancelled';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
  BEGIN CALL sp_cancel_appointment('00000000-0000-4000-a000-00000000ffff', 'CANCELLED_BY_ADMIN');
        RAISE EXCEPTION 'unknown accepted';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000510', 'BOOKED');
        RAISE EXCEPTION 'BOOKED accepted as cancel status';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN CALL sp_respond_to_query('00000000-0000-4000-a000-000000000704', 'RESOLVED', 'x');
        RAISE EXCEPTION 'closed query changed';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
  PERFORM pg_temp.record('T11', 'Procedures', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T11', 'Procedures', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T12  Audit trigger fires only on real status changes
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'status change writes 1 audit row (old/new/session_user); same-status and non-status updates write none';
BEGIN
  BEGIN
    UPDATE "appointments" SET "status" = 'CONFIRMED', "updatedAt" = now() WHERE "id" = '00000000-0000-4000-a000-000000000512';
    UPDATE "appointments" SET "status" = 'CONFIRMED', "updatedAt" = now() WHERE "id" = '00000000-0000-4000-a000-000000000512';
    UPDATE "appointments" SET "notes" = 'n', "updatedAt" = now() WHERE "id" = '00000000-0000-4000-a000-000000000512';
    PERFORM pg_temp.assert((SELECT COUNT(*) FROM "appointment_status_audit"
                            WHERE "appointmentId" = '00000000-0000-4000-a000-000000000512') = 1, 'exactly one audit row');
    PERFORM pg_temp.assert((SELECT "oldStatus" = 'BOOKED' AND "newStatus" = 'CONFIRMED' AND "changedBy" = session_user
                            FROM "appointment_status_audit"
                            WHERE "appointmentId" = '00000000-0000-4000-a000-000000000512'), 'audit content');
    RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'undo';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
  END;
  PERFORM pg_temp.record('T12', 'Triggers', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T12', 'Triggers', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T13  respondedAt trigger
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'response set -> respondedAt=now(); unchanged response keeps it; cleared -> NULL; blank -> NULL';
BEGIN
  BEGIN
    UPDATE "queries" SET "adminResponse" = 'Hello' WHERE "id" = '00000000-0000-4000-a000-000000000705';
    PERFORM pg_temp.assert((SELECT "respondedAt" = now() FROM "queries" WHERE "id" = '00000000-0000-4000-a000-000000000705'), 'set');
    UPDATE "queries" SET "adminResponse" = "adminResponse" WHERE "id" = '00000000-0000-4000-a000-000000000704';
    PERFORM pg_temp.assert((SELECT "respondedAt" = TIMESTAMPTZ '2026-09-20 12:00:00+00' FROM "queries"
                            WHERE "id" = '00000000-0000-4000-a000-000000000704'), 'unchanged kept');
    UPDATE "queries" SET "adminResponse" = NULL WHERE "id" = '00000000-0000-4000-a000-000000000705';
    PERFORM pg_temp.assert((SELECT "respondedAt" IS NULL FROM "queries" WHERE "id" = '00000000-0000-4000-a000-000000000705'), 'cleared');
    UPDATE "queries" SET "adminResponse" = '   ' WHERE "id" = '00000000-0000-4000-a000-000000000701';
    PERFORM pg_temp.assert((SELECT "adminResponse" IS NULL AND "respondedAt" IS NULL FROM "queries"
                            WHERE "id" = '00000000-0000-4000-a000-000000000701'), 'blank');
    RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'undo';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
  END;
  PERFORM pg_temp.record('T13', 'Triggers', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T13', 'Triggers', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T14  Rollback / savepoint semantics
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'failed inner block (savepoint) undoes only its own writes; outer work and its audit row survive until outer undo';
BEGIN
  BEGIN
    UPDATE "appointments" SET "status" = 'CONFIRMED', "updatedAt" = now() WHERE "id" = '00000000-0000-4000-a000-000000000511';
    BEGIN   -- inner subtransaction = SAVEPOINT
      UPDATE "appointments" SET "status" = 'CONFIRMED', "updatedAt" = now() WHERE "id" = '00000000-0000-4000-a000-000000000513';
      INSERT INTO "feedback" ("patientId", "subject", "message", "rating")
      VALUES ('00000000-0000-4000-a000-000000000201', 'T14', 'bad', 6);   -- fails
    EXCEPTION WHEN check_violation THEN NULL;                            -- ROLLBACK TO SAVEPOINT
    END;
    PERFORM pg_temp.assert((SELECT "status" FROM "appointments" WHERE "id" = '00000000-0000-4000-a000-000000000511') = 'CONFIRMED', 'outer kept');
    PERFORM pg_temp.assert((SELECT "status" FROM "appointments" WHERE "id" = '00000000-0000-4000-a000-000000000513') = 'BOOKED', 'inner undone');
    PERFORM pg_temp.assert((SELECT COUNT(*) FROM "appointment_status_audit") = 1, 'only outer audit row');
    RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'undo';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
  END;
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM "appointment_status_audit") = 0, 'full undo removes audit row');
  PERFORM pg_temp.assert((SELECT "status" FROM "appointments" WHERE "id" = '00000000-0000-4000-a000-000000000511') = 'BOOKED', 'outer undone');
  PERFORM pg_temp.record('T14', 'Transactions', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T14', 'Transactions', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T15  Least privilege: allowed operations
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'reporting login reads the views; operator role can CALL the cancel procedure';
BEGIN
  BEGIN
    SET LOCAL ROLE medicore_dbms_demo_login;
    PERFORM pg_temp.assert((SELECT COUNT(*) FROM "vw_dbms_public_doctor_directory") >= 5, 'directory readable');
    PERFORM pg_temp.assert((SELECT COUNT(*) FROM "vw_dbms_doctor_appointment_stats") >= 6, 'stats readable');
    SET LOCAL ROLE medicore_dbms_operator;
    CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000510', 'CANCELLED_BY_ADMIN', NULL, TIMESTAMPTZ '2026-10-10 09:00+00');
    RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'undo';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
  END;
  PERFORM pg_temp.assert(current_user = session_user, 'role reset after undo');
  PERFORM pg_temp.record('T15', 'Security', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T15', 'Security', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T16  Least privilege: denied operations
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'reporting login is denied base tables, writes and procedures; operator is denied direct UPDATE (insufficient_privilege)';
DECLARE denied INTEGER := 0;
BEGIN
  BEGIN
    SET LOCAL ROLE medicore_dbms_demo_login;
    BEGIN PERFORM 1 FROM "patients" LIMIT 1; EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
    BEGIN DELETE FROM "feedback"; EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
    BEGIN CALL sp_respond_to_query('00000000-0000-4000-a000-000000000702', 'CLOSED');
    EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
    SET LOCAL ROLE medicore_dbms_operator;
    BEGIN UPDATE "appointments" SET "status" = 'BOOKED' WHERE FALSE;
    EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
    RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'undo';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
  END;
  PERFORM pg_temp.assert(denied = 4, format('4 denials expected, got %s', denied));
  PERFORM pg_temp.record('T16', 'Security', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T16', 'Security', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T17  Index evidence
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  d TEXT := 'composite patient index exists, old single-column index gone, bounded upcoming query plans an Index Scan with no Sort';
  plan TEXT := '';
  line TEXT;
BEGIN
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'appointments_patientId_appointmentDate_startTime_idx'), 'composite exists');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'appointments_patientId_idx'), 'old index dropped');
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM "appointments") > 100000, 'synthetic load present (run 12 first)');
  FOR line IN EXECUTE $q$EXPLAIN SELECT "id" FROM "appointments"
      WHERE "patientId" = '00000000-0000-4000-c210-000000000001' AND "appointmentDate" >= DATE '2026-10-10'
      ORDER BY "appointmentDate", "startTime" LIMIT 5$q$ LOOP
    plan := plan || line || E'\n';
  END LOOP;
  PERFORM pg_temp.assert(plan LIKE '%Index Scan using "appointments_patientId_appointmentDate_startTime_idx"%', 'uses composite');
  PERFORM pg_temp.assert(plan NOT LIKE '%Sort%', 'no sort node');
  PERFORM pg_temp.record('T17', 'Indexing', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T17', 'Indexing', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T18  Cursor reads every row exactly once, in order
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  d TEXT := 'explicit cursor over active upcoming demo appointments fetches the same rows, in the same order, as the set-based query';
  cur CURSOR FOR SELECT appointment_id FROM "vw_dbms_appointment_details"
                 WHERE status_group = 'ACTIVE' AND appointment_id::TEXT LIKE '00000000-0000-4000-a000-%'
                 ORDER BY appointment_date, start_time, appointment_id;
  rec RECORD;
  via_cursor TEXT := '';
BEGIN
  OPEN cur;
  LOOP
    FETCH cur INTO rec;
    EXIT WHEN NOT FOUND;
    via_cursor := via_cursor || right(rec.appointment_id::TEXT, 3) || ',';
  END LOOP;
  CLOSE cur;
  PERFORM pg_temp.assert(via_cursor = (
    SELECT string_agg(right(appointment_id::TEXT, 3), ',' ORDER BY appointment_date, start_time, appointment_id) || ','
    FROM "vw_dbms_appointment_details"
    WHERE status_group = 'ACTIVE' AND appointment_id::TEXT LIKE '00000000-0000-4000-a000-%'), 'same sequence');
  PERFORM pg_temp.record('T18', 'Cursors', d, 'PASS', via_cursor);
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T18', 'Cursors', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- T19  Demo data intact after the whole suite
-- -----------------------------------------------------------------------------
DO $$
DECLARE d TEXT := 'after all cases: demo row counts unchanged and no audit rows (every case cleaned up)';
BEGIN
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM "appointments" WHERE "id"::TEXT LIKE '00000000-0000-4000-a000-%') = 15, '15 demo appointments');
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM "feedback") = 5, '5 feedback');
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM "queries") = 5, '5 queries');
  PERFORM pg_temp.assert((SELECT COUNT(*) FROM "appointment_status_audit") = 0, '0 audit rows');
  PERFORM pg_temp.assert((SELECT "status" FROM "appointments" WHERE "id" = '00000000-0000-4000-a000-000000000510') = 'BOOKED', '510 BOOKED');
  PERFORM pg_temp.record('T19', 'Isolation', d, 'PASS');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.record('T19', 'Isolation', d, 'FAIL', SQLERRM);
END $$;

-- -----------------------------------------------------------------------------
-- Summary
-- -----------------------------------------------------------------------------
SELECT case_id, area, status, description, detail FROM test_results ORDER BY case_id;

SELECT COUNT(*) FILTER (WHERE status = 'PASS') AS passed,
       COUNT(*) FILTER (WHERE status = 'FAIL') AS failed,
       COUNT(*) AS total
FROM test_results;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_temp.test_results WHERE status = 'FAIL') THEN
    RAISE EXCEPTION 'DBMS SQL test suite: % failing case(s)',
      (SELECT COUNT(*) FROM pg_temp.test_results WHERE status = 'FAIL');
  END IF;
END $$;
