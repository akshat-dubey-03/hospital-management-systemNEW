-- =============================================================================
-- MediCore HMS — tests for MEDICAL_RECORD, PRESCRIPTION and BILL
-- (migration 20261025100000_medical_records_bills_prescriptions)
-- =============================================================================
-- Run against any migrated database (dev or test):
--   psql "$DATABASE_URL" -X -f docs/dbms/tests/medical_billing_tests.sql
--
-- Everything runs inside one transaction that is ROLLED BACK at the end, so no
-- data is changed. Each case prints PASS/FAIL; the script raises an error at
-- the end (non-zero psql exit) if any case failed.
-- =============================================================================

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE mb_results (case_id TEXT PRIMARY KEY, description TEXT, status TEXT, detail TEXT) ON COMMIT DROP;

-- Fixture: one department, two doctors, one patient, two appointments (doctor A).
DO $$
DECLARE
  v_dept UUID; v_ua UUID; v_ub UUID; v_up UUID; v_da UUID; v_db UUID; v_p UUID;
BEGIN
  INSERT INTO departments (name) VALUES ('MB Test Dept ' || clock_timestamp()) RETURNING id INTO v_dept;
  INSERT INTO users (email, "passwordHash", role, "updatedAt") VALUES ('mb.doca@test.local', 'x', 'DOCTOR', now()) RETURNING id INTO v_ua;
  INSERT INTO users (email, "passwordHash", role, "updatedAt") VALUES ('mb.docb@test.local', 'x', 'DOCTOR', now()) RETURNING id INTO v_ub;
  INSERT INTO users (email, "passwordHash", role, "updatedAt") VALUES ('mb.pat@test.local',  'x', 'PATIENT', now()) RETURNING id INTO v_up;
  INSERT INTO doctors ("userId", "departmentId", "firstName", "lastName", specialization, qualification, "consultationFee", "updatedAt")
    VALUES (v_ua, v_dept, 'Mb', 'DocA', 'Gen', 'MBBS', 500, now()) RETURNING id INTO v_da;
  INSERT INTO doctors ("userId", "departmentId", "firstName", "lastName", specialization, qualification, "updatedAt")
    VALUES (v_ub, v_dept, 'Mb', 'DocB', 'Gen', 'MBBS', now()) RETURNING id INTO v_db;
  INSERT INTO patients ("userId", "firstName", "lastName", "updatedAt") VALUES (v_up, 'Mb', 'Pat', now()) RETURNING id INTO v_p;
  INSERT INTO appointments (id, "patientId", "doctorId", "appointmentDate", "startTime", "endTime", status, "updatedAt") VALUES
    ('00000000-0000-4000-c000-000000000001', v_p, v_da, DATE '2030-01-07', '09:00', '09:30', 'COMPLETED', now()),
    ('00000000-0000-4000-c000-000000000002', v_p, v_da, DATE '2030-01-07', '10:00', '10:30', 'COMPLETED', now());
  PERFORM set_config('mb.da', v_da::text, true);
  PERFORM set_config('mb.db', v_db::text, true);
END $$;

-- Helper: run a statement in a subtransaction and record whether it failed with
-- the expected SQLSTATE (NULL expected = must succeed).
CREATE FUNCTION pg_temp.mb_case(p_id TEXT, p_desc TEXT, p_sql TEXT, p_expect TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    IF p_expect IS NULL THEN
      INSERT INTO mb_results VALUES (p_id, p_desc, 'PASS', 'succeeded');
    ELSE
      INSERT INTO mb_results VALUES (p_id, p_desc, 'FAIL', 'expected ' || p_expect || ', statement succeeded');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO mb_results VALUES (p_id, p_desc,
      CASE WHEN SQLSTATE = p_expect THEN 'PASS' ELSE 'FAIL' END, SQLSTATE || ': ' || SQLERRM);
  END;
END $$;

SELECT pg_temp.mb_case('MB01', 'record for appointment by its own doctor is accepted',
  format($q$INSERT INTO medical_records (id, "appointmentId", "doctorId", diagnosis, "updatedAt")
            VALUES ('00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-c000-000000000001', %L, 'Viral fever', now())$q$,
         current_setting('mb.da')), NULL);

SELECT pg_temp.mb_case('MB02', 'second record for the same appointment is rejected (0..1, unique)',
  format($q$INSERT INTO medical_records ("appointmentId", "doctorId", diagnosis, "updatedAt")
            VALUES ('00000000-0000-4000-c000-000000000001', %L, 'Duplicate', now())$q$,
         current_setting('mb.da')), '23505');

SELECT pg_temp.mb_case('MB03', 'record by a different doctor is rejected by trigger',
  format($q$INSERT INTO medical_records ("appointmentId", "doctorId", diagnosis, "updatedAt")
            VALUES ('00000000-0000-4000-c000-000000000002', %L, 'Wrong doctor', now())$q$,
         current_setting('mb.db')), '23514');

SELECT pg_temp.mb_case('MB04', 'blank diagnosis is rejected by CHECK',
  format($q$INSERT INTO medical_records ("appointmentId", "doctorId", diagnosis, "updatedAt")
            VALUES ('00000000-0000-4000-c000-000000000002', %L, '   ', now())$q$,
         current_setting('mb.da')), '23514');

SELECT pg_temp.mb_case('MB05', 'record for a non-existent appointment is rejected by FK',
  format($q$INSERT INTO medical_records ("appointmentId", "doctorId", diagnosis, "updatedAt")
            VALUES (gen_random_uuid(), %L, 'Orphan', now())$q$,
         current_setting('mb.da')), '23503');

SELECT pg_temp.mb_case('MB06', 'multiple prescriptions on one record are accepted (1:N)',
  $q$INSERT INTO prescriptions ("medicalRecordId", "medicineName", dosage, frequency, duration) VALUES
     ('00000000-0000-4000-c000-0000000000a1', 'Paracetamol', '500 mg', 'Twice daily', '5 days'),
     ('00000000-0000-4000-c000-0000000000a1', 'ORS', '1 sachet', 'After each loose stool', '3 days')$q$, NULL);

SELECT pg_temp.mb_case('MB07', 'blank prescription field is rejected by CHECK',
  $q$INSERT INTO prescriptions ("medicalRecordId", "medicineName", dosage, frequency, duration)
     VALUES ('00000000-0000-4000-c000-0000000000a1', 'Cetirizine', '', 'Once', '3 days')$q$, '23514');

SELECT pg_temp.mb_case('MB08', 'bill for an appointment is accepted with default PENDING status',
  $q$INSERT INTO bills (id, "appointmentId", amount, "updatedAt")
     VALUES ('00000000-0000-4000-c000-0000000000b1', '00000000-0000-4000-c000-000000000001', 500.00, now())$q$, NULL);

SELECT pg_temp.mb_case('MB09', 'second bill for the same appointment is rejected (0..1, unique)',
  $q$INSERT INTO bills ("appointmentId", amount, "updatedAt")
     VALUES ('00000000-0000-4000-c000-000000000001', 100, now())$q$, '23505');

SELECT pg_temp.mb_case('MB10', 'negative bill amount is rejected by CHECK',
  $q$INSERT INTO bills ("appointmentId", amount, "updatedAt")
     VALUES ('00000000-0000-4000-c000-000000000002', -1, now())$q$, '23514');

SELECT pg_temp.mb_case('MB11', 'invalid payment status is rejected by the enum type',
  $q$UPDATE bills SET "paymentStatus" = 'REFUNDED' WHERE id = '00000000-0000-4000-c000-0000000000b1'$q$, '22P02');

SELECT pg_temp.mb_case('MB12', 'PAID without paidAt is rejected by CHECK',
  $q$UPDATE bills SET "paymentStatus" = 'PAID' WHERE id = '00000000-0000-4000-c000-0000000000b1'$q$, '23514');

SELECT pg_temp.mb_case('MB13', 'PAID with paidAt is accepted',
  $q$UPDATE bills SET "paymentStatus" = 'PAID', "paidAt" = now() WHERE id = '00000000-0000-4000-c000-0000000000b1'$q$, NULL);

SELECT pg_temp.mb_case('MB14', 'deleting a billed / recorded appointment is rejected (RESTRICT)',
  $q$DELETE FROM appointments WHERE id = '00000000-0000-4000-c000-000000000001'$q$, '23503');

SELECT pg_temp.mb_case('MB15', 'deleting a doctor with appointments/records is rejected (RESTRICT)',
  format($q$DELETE FROM doctors WHERE id = %L$q$, current_setting('mb.da')), '23503');

-- MB16: deleting a medical record cascades to its prescriptions (then undone).
DO $$
DECLARE v_before INT; v_after INT;
BEGIN
  SELECT count(*) INTO v_before FROM prescriptions WHERE "medicalRecordId" = '00000000-0000-4000-c000-0000000000a1';
  BEGIN
    DELETE FROM medical_records WHERE id = '00000000-0000-4000-c000-0000000000a1';
    SELECT count(*) INTO v_after FROM prescriptions WHERE "medicalRecordId" = '00000000-0000-4000-c000-0000000000a1';
    RAISE EXCEPTION 'undo' USING ERRCODE = 'P0099';  -- roll back the delete only
  EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
  END;
  INSERT INTO mb_results VALUES ('MB16', 'deleting a record cascades to its prescriptions',
    CASE WHEN v_before = 2 AND v_after = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('before=%s after=%s', v_before, v_after));
END $$;

SELECT case_id, status, description, detail FROM mb_results ORDER BY case_id;

DO $$
DECLARE v_fail INT; v_total INT;
BEGIN
  SELECT count(*) FILTER (WHERE status = 'FAIL'), count(*) INTO v_fail, v_total FROM mb_results;
  RAISE NOTICE 'medical/billing tests: % passed, % failed', v_total - v_fail, v_fail;
  IF v_fail > 0 THEN RAISE EXCEPTION '% medical/billing test case(s) failed', v_fail; END IF;
END $$;

ROLLBACK;
