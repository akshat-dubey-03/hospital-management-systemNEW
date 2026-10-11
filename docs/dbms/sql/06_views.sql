-- =============================================================================
-- MediCore HMS — Views (Review 3)
-- =============================================================================
-- Part 1 is byte-for-byte the migration
--   backend/prisma/migrations/20261011110000_dbms_views/migration.sql
-- (kept identical; the DBMS test suite checks this). Part 2 demonstrates and
-- verifies the views against the 02_dml.sql demo data.
-- Run on a disposable database after 01_ddl.sql and 02_dml.sql.
-- =============================================================================

-- ---------------------------- Part 1: definitions ----------------------------
-- DBMS Review 3 — reporting and security views.
--
-- Plain (non-materialised) views over the existing tables; no table changes.
-- The application does not query these views. Prisma 5 ignores views when
-- diffing, so they cause no schema drift. All three are read-only in practice:
-- each joins several tables or aggregates, so PostgreSQL does not make them
-- automatically updatable.

-- 1. Appointment detail (4-table join).
--    One row per appointment with patient, doctor and department names.
--    Deliberately excludes the doctor-only "notes" column and all patient
--    contact/medical fields (phone, address, dateOfBirth, bloodGroup).
CREATE OR REPLACE VIEW "vw_dbms_appointment_details" AS
SELECT
  a."id"               AS appointment_id,
  a."appointmentDate"  AS appointment_date,
  a."startTime"        AS start_time,
  a."endTime"          AS end_time,
  a."status"           AS status,
  CASE
    WHEN a."status" IN ('BOOKED', 'CONFIRMED') THEN 'ACTIVE'
    WHEN a."status" = 'COMPLETED'              THEN 'COMPLETED'
    ELSE 'CANCELLED'
  END                  AS status_group,
  a."reasonForVisit"   AS reason_for_visit,
  a."cancellationReason" AS cancellation_reason,
  p."id"               AS patient_id,
  p."firstName" || ' ' || p."lastName" AS patient_name,
  d."id"               AS doctor_id,
  d."firstName" || ' ' || d."lastName" AS doctor_name,
  d."specialization"   AS specialization,
  dep."id"             AS department_id,
  dep."name"           AS department_name
FROM "appointments" AS a
JOIN "patients"    AS p   ON p."id"   = a."patientId"
JOIN "doctors"     AS d   ON d."id"   = a."doctorId"
JOIN "departments" AS dep ON dep."id" = d."departmentId";

COMMENT ON VIEW "vw_dbms_appointment_details" IS
  'One row per appointment joined to patient, doctor and department names. Excludes clinical notes and patient contact data. Read-only (multi-table join).';

-- 2. Doctor appointment statistics (aggregate).
--    One row per doctor, including doctors with no appointments (LEFT JOIN).
--    estimated_completed_fees multiplies completed visits by the doctor's
--    CURRENT consultationFee: an estimate, not billed revenue (no invoice table).
CREATE OR REPLACE VIEW "vw_dbms_doctor_appointment_stats" AS
SELECT
  d."id"                                   AS doctor_id,
  d."firstName" || ' ' || d."lastName"     AS doctor_name,
  dep."name"                               AS department_name,
  d."isActive"                             AS doctor_is_active,
  COUNT(a."id")                            AS total_appointments,
  COUNT(a."id") FILTER (WHERE a."status" = 'BOOKED')    AS booked_count,
  COUNT(a."id") FILTER (WHERE a."status" = 'CONFIRMED') AS confirmed_count,
  COUNT(a."id") FILTER (WHERE a."status" = 'COMPLETED') AS completed_count,
  COUNT(a."id") FILTER (WHERE a."status" IN
    ('CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR', 'CANCELLED_BY_ADMIN')) AS cancelled_count,
  COUNT(DISTINCT a."patientId")            AS distinct_patients,
  ROUND(100.0 * COUNT(a."id") FILTER (WHERE a."status" = 'COMPLETED')
        / NULLIF(COUNT(a."id"), 0), 1)     AS completion_rate_pct,
  COALESCE(d."consultationFee", 0)
    * COUNT(a."id") FILTER (WHERE a."status" = 'COMPLETED') AS estimated_completed_fees,
  MAX(a."appointmentDate") FILTER (WHERE a."status" = 'COMPLETED') AS last_completed_date
FROM "doctors" AS d
JOIN "departments" AS dep ON dep."id" = d."departmentId"
LEFT JOIN "appointments" AS a ON a."doctorId" = d."id"
GROUP BY d."id", d."firstName", d."lastName", dep."name", d."isActive", d."consultationFee";

COMMENT ON VIEW "vw_dbms_doctor_appointment_stats" IS
  'Per-doctor appointment counts by status. estimated_completed_fees = completed visits x current fee (estimate, not billing). Read-only (GROUP BY).';

-- 3. Public doctor directory (row- and column-restricting).
--    Rows: only doctors whose profile AND login account are active.
--    Columns: professional information only — no phone, email, userId or
--    password data.
--    security_barrier = true makes PostgreSQL evaluate the view's own WHERE
--    before any caller-supplied condition, so a caller's function in WHERE
--    cannot observe hidden (inactive) rows. It does not restrict which
--    columns a caller sees and is not per-user row-level security; privileges
--    are granted on this view in the SQL security phase.
CREATE OR REPLACE VIEW "vw_dbms_public_doctor_directory"
WITH (security_barrier = true) AS
SELECT
  d."id"                  AS doctor_id,
  d."firstName"           AS first_name,
  d."lastName"            AS last_name,
  d."specialization"      AS specialization,
  d."qualification"       AS qualification,
  d."experienceYears"     AS experience_years,
  d."consultationFee"     AS consultation_fee,
  d."slotDurationMinutes" AS slot_duration_minutes,
  dep."name"              AS department_name
FROM "doctors" AS d
JOIN "users"       AS u   ON u."id"   = d."userId"
JOIN "departments" AS dep ON dep."id" = d."departmentId"
WHERE d."isActive" = TRUE
  AND u."isActive" = TRUE;

COMMENT ON VIEW "vw_dbms_public_doctor_directory" IS
  'Active doctors only, public professional columns only (no phone/email/userId). security_barrier view; read-only (join).';

-- =============================================================================
-- DEMONSTRATION (not part of the migration)
-- Requires 02_dml.sql demo data.
-- =============================================================================

-- V-1  Sample use: upcoming active appointments from the detail view.
SELECT appointment_date, start_time, status, patient_name, doctor_name, department_name
FROM "vw_dbms_appointment_details"
WHERE status_group = 'ACTIVE' AND appointment_date >= DATE '2026-10-01'
ORDER BY appointment_date, start_time;

-- V-1 check: the view returns exactly the rows of the equivalent base-table
-- join (symmetric difference must be empty, row counts equal).
WITH base AS (
  SELECT a."id", p."firstName" || ' ' || p."lastName" AS patient_name,
         d."firstName" || ' ' || d."lastName" AS doctor_name, dep."name" AS department_name
  FROM "appointments" a
  JOIN "patients" p ON p."id" = a."patientId"
  JOIN "doctors" d ON d."id" = a."doctorId"
  JOIN "departments" dep ON dep."id" = d."departmentId"
), v AS (
  SELECT appointment_id, patient_name, doctor_name, department_name
  FROM "vw_dbms_appointment_details"
)
SELECT (SELECT COUNT(*) FROM base) AS base_rows,
       (SELECT COUNT(*) FROM v)    AS view_rows,
       (SELECT COUNT(*) FROM ((SELECT * FROM base EXCEPT SELECT * FROM v)
                              UNION ALL
                              (SELECT * FROM v EXCEPT SELECT * FROM base)) x) AS mismatched_rows;

-- V-2  Sample use: doctor workload ranking from the aggregate view.
SELECT doctor_name, department_name, total_appointments, booked_count, confirmed_count,
       completed_count, cancelled_count, completion_rate_pct, estimated_completed_fees
FROM "vw_dbms_doctor_appointment_stats"
ORDER BY total_appointments DESC, doctor_name;

-- V-2 check: per-doctor totals agree with a direct GROUP BY on appointments,
-- and doctors with no appointments appear with 0 (LEFT JOIN).
SELECT s.doctor_name, s.total_appointments, s.completed_count,
       COALESCE(b.total, 0)     AS base_total,
       COALESCE(b.completed, 0) AS base_completed,
       (s.total_appointments = COALESCE(b.total, 0)
        AND s.completed_count = COALESCE(b.completed, 0)) AS matches
FROM "vw_dbms_doctor_appointment_stats" s
LEFT JOIN (
  SELECT "doctorId", COUNT(*) AS total, COUNT(*) FILTER (WHERE "status" = 'COMPLETED') AS completed
  FROM "appointments" GROUP BY "doctorId"
) b ON b."doctorId" = s.doctor_id
ORDER BY s.doctor_name;

-- V-3  Sample use: public directory.
SELECT first_name, last_name, specialization, department_name, consultation_fee
FROM "vw_dbms_public_doctor_directory"
ORDER BY last_name;

-- V-3 row restriction: all doctors vs directory (inactive Dr Gupta is hidden).
SELECT d."lastName", d."isActive" AS doctor_active, u."isActive" AS user_active,
       EXISTS (SELECT 1 FROM "vw_dbms_public_doctor_directory" v WHERE v.doctor_id = d."id") AS in_directory
FROM "doctors" d JOIN "users" u ON u."id" = d."userId"
ORDER BY d."lastName";

-- V-3 column restriction: the directory exposes no contact or account columns.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vw_dbms_public_doctor_directory'
ORDER BY ordinal_position;

-- V-4  Updatability, as reported by PostgreSQL.
SELECT table_name, is_updatable, is_insertable_into
FROM information_schema.views
WHERE table_schema = 'public' AND table_name LIKE 'vw_dbms_%'
ORDER BY table_name;

-- V-4 proof: writing through a join view is refused.
DO $$
BEGIN
  UPDATE "vw_dbms_public_doctor_directory" SET consultation_fee = 1 WHERE last_name = 'Sharma';
  RAISE EXCEPTION 'FAIL: update through the view was accepted';
EXCEPTION WHEN object_not_in_prerequisite_state OR feature_not_supported THEN
  RAISE NOTICE 'PASS view is read-only: %', SQLERRM;
END $$;

-- V-5  What security_barrier prevents.
-- A cheap function in the caller's WHERE clause would normally be pushed down
-- and run against base rows BEFORE the view's own filter, so it could "see"
-- hidden rows. The function below reports every row it is called with.
CREATE FUNCTION pg_temp.peek(name TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql COST 0.0000001 AS $$
BEGIN
  RAISE NOTICE 'peek() saw doctor: %', name;
  RETURN TRUE;
END $$;

-- Two temporary views with the SAME definition, differing only in
-- security_barrier. Their only filter is on the joined users table, so without
-- a barrier the planner may run peek() on the doctors scan before the join
-- removes the hidden doctor (Gupta, whose login is inactive).
CREATE TEMP VIEW directory_plain AS
SELECT d."lastName" AS last_name
FROM "doctors" d JOIN "users" u ON u."id" = d."userId"
WHERE u."isActive" = TRUE;

CREATE TEMP VIEW directory_barrier WITH (security_barrier = true) AS
SELECT d."lastName" AS last_name
FROM "doctors" d JOIN "users" u ON u."id" = d."userId"
WHERE u."isActive" = TRUE;

\echo '-- Plain view: peek() may also report the hidden doctor (Gupta)'
SELECT last_name FROM directory_plain WHERE pg_temp.peek(last_name) ORDER BY last_name;

\echo '-- security_barrier view: peek() only sees rows that passed the view filter'
SELECT last_name FROM directory_barrier WHERE pg_temp.peek(last_name) ORDER BY last_name;

\echo '-- Plan of the real directory view: caller condition stays above the view (Subquery Scan)'
EXPLAIN (COSTS OFF)
SELECT last_name FROM "vw_dbms_public_doctor_directory" WHERE pg_temp.peek(last_name);
