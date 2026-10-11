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
