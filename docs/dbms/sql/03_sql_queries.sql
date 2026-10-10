-- =============================================================================
-- MediCore HMS — Categorised SQL queries (Review 2)
-- =============================================================================
-- Assumes 01_ddl.sql and Section A of 02_dml.sql have been applied on a
-- disposable database. Identifiers BQ-A01 … BQ-G04.
--
-- Column names are quoted to match Prisma camelCase.
-- These statements have not been executed against PostgreSQL in this phase.
-- Numeric result values below are therefore unverified.
-- =============================================================================

-- =============================================================================
-- A. Basic queries
-- =============================================================================

-- BQ-A01  SELECT: list active doctors with department fee context later via join.
-- Business: directory of doctors currently marked active.
SELECT
  d."id",
  d."firstName",
  d."lastName",
  d."specialization",
  d."consultationFee"
FROM "doctors" AS d
WHERE d."isActive" = TRUE
ORDER BY d."lastName", d."firstName";

-- BQ-A02  WHERE + ORDER BY: upcoming booked or confirmed appointments after a fixed date.
SELECT
  a."id",
  a."appointmentDate",
  a."startTime",
  a."status",
  a."reasonForVisit"
FROM "appointments" AS a
WHERE a."appointmentDate" >= DATE '2026-10-01'
  AND a."status" IN ('BOOKED', 'CONFIRMED')
ORDER BY a."appointmentDate", a."startTime";

-- BQ-A03  DISTINCT: blood groups recorded for patients (ignores NULL).
SELECT DISTINCT p."bloodGroup"
FROM "patients" AS p
WHERE p."bloodGroup" IS NOT NULL
ORDER BY p."bloodGroup";

-- BQ-A04  BETWEEN: appointments in August 2026 inclusive.
SELECT
  a."id",
  a."appointmentDate",
  a."status"
FROM "appointments" AS a
WHERE a."appointmentDate" BETWEEN DATE '2026-08-01' AND DATE '2026-08-31'
ORDER BY a."appointmentDate";

-- BQ-A05  IN: support tickets that still need staff attention.
SELECT
  q."id",
  q."subject",
  q."status",
  q."createdAt"
FROM "queries" AS q
WHERE q."status" IN ('OPEN', 'IN_PROGRESS')
ORDER BY q."createdAt";

-- BQ-A06  LIKE: doctors whose qualification mentions DM (super-specialty).
SELECT
  d."firstName",
  d."lastName",
  d."qualification"
FROM "doctors" AS d
WHERE d."qualification" LIKE '%DM%'
ORDER BY d."lastName";

-- BQ-A07  IS NULL: patients missing address (incomplete registration).
SELECT
  p."id",
  p."firstName",
  p."lastName",
  p."phone"
FROM "patients" AS p
WHERE p."address" IS NULL
ORDER BY p."lastName";

-- BQ-A08  IS NULL / filtering cancelledAt: cancellations that recorded a timestamp.
SELECT
  a."id",
  a."status",
  a."cancellationReason",
  a."cancelledAt"
FROM "appointments" AS a
WHERE a."cancelledAt" IS NOT NULL
ORDER BY a."cancelledAt";

-- =============================================================================
-- B. Aggregate queries
-- =============================================================================
-- WHERE vs HAVING:
--   WHERE  filters *rows* before groups are formed (e.g. ignore cancelled visits).
--   HAVING filters *groups* after aggregation (e.g. keep departments with COUNT >= 2).
-- You cannot put COUNT(*) in WHERE; that belongs in HAVING.

-- BQ-B01  COUNT: appointments per status.
SELECT
  a."status",
  COUNT(*) AS appointment_count
FROM "appointments" AS a
GROUP BY a."status"
ORDER BY appointment_count DESC, a."status";

-- BQ-B02  SUM: estimated consultation-fee potential for completed visits.
--         This is not recorded billing/revenue: fee is stored on doctors,
--         not on appointment or invoice records.
SELECT
  SUM(d."consultationFee") AS estimated_completed_fee_total
FROM "appointments" AS a
JOIN "doctors" AS d ON d."id" = a."doctorId"
WHERE a."status" = 'COMPLETED';

-- BQ-B03  AVG / MIN / MAX: rating statistics (NULL ratings excluded by AVG).
SELECT
  COUNT(*) AS feedback_rows,
  COUNT(f."rating") AS rated_rows,
  AVG(f."rating") AS avg_rating,
  MIN(f."rating") AS min_rating,
  MAX(f."rating") AS max_rating
FROM "feedback" AS f;

-- BQ-B04  GROUP BY: completed visits and average current doctor fee per visit by department.
--         A doctor with more completed visits contributes their current fee once per visit.
SELECT
  dep."name" AS department_name,
  COUNT(*) AS completed_visits,
  AVG(d."consultationFee") AS avg_fee
FROM "appointments" AS a
JOIN "doctors" AS d ON d."id" = a."doctorId"
JOIN "departments" AS dep ON dep."id" = d."departmentId"
WHERE a."status" = 'COMPLETED'
GROUP BY dep."name"
ORDER BY completed_visits DESC, dep."name";

-- BQ-B05  HAVING: doctors with at least two appointments of any status.
SELECT
  d."id",
  d."firstName",
  d."lastName",
  COUNT(*) AS appointment_count
FROM "appointments" AS a
JOIN "doctors" AS d ON d."id" = a."doctorId"
GROUP BY d."id", d."firstName", d."lastName"
HAVING COUNT(*) >= 2
ORDER BY appointment_count DESC;

-- BQ-B06  WHERE + HAVING together: among non-cancelled appointments, doctors
--         whose BOOKED/CONFIRMED/COMPLETED load is at least 2.
SELECT
  d."lastName",
  COUNT(*) AS active_load
FROM "appointments" AS a
JOIN "doctors" AS d ON d."id" = a."doctorId"
WHERE a."status" NOT IN (
  'CANCELLED_BY_PATIENT',
  'CANCELLED_BY_DOCTOR',
  'CANCELLED_BY_ADMIN'
)
GROUP BY d."id", d."lastName"
HAVING COUNT(*) >= 2
ORDER BY active_load DESC;

-- BQ-B07  COUNT DISTINCT: how many distinct patients each doctor has seen.
SELECT
  d."firstName",
  d."lastName",
  COUNT(DISTINCT a."patientId") AS distinct_patients
FROM "doctors" AS d
JOIN "appointments" AS a ON a."doctorId" = d."id"
GROUP BY d."id", d."firstName", d."lastName"
ORDER BY distinct_patients DESC, d."lastName";

-- =============================================================================
-- C. Joins
-- =============================================================================

-- BQ-C01  INNER JOIN: booked encounters with patient and doctor names.
SELECT
  a."appointmentDate",
  a."startTime",
  a."status",
  p."firstName" AS patient_first,
  p."lastName" AS patient_last,
  d."firstName" AS doctor_first,
  d."lastName" AS doctor_last
FROM "appointments" AS a
INNER JOIN "patients" AS p ON p."id" = a."patientId"
INNER JOIN "doctors" AS d ON d."id" = a."doctorId"
ORDER BY a."appointmentDate", a."startTime";

-- BQ-C02  LEFT JOIN: every department, including those with no doctors (Oncology).
SELECT
  dep."name" AS department_name,
  d."id" AS doctor_id,
  d."firstName",
  d."lastName"
FROM "departments" AS dep
LEFT JOIN "doctors" AS d ON d."departmentId" = dep."id"
ORDER BY dep."name", d."lastName" NULLS LAST;

-- BQ-C03  RIGHT JOIN: same department/doctor pairing from the doctor side.
--         Departments with no doctors still appear if the FROM table is doctors
--         and departments is on the right? RIGHT JOIN keeps all right-table rows.
SELECT
  dep."name" AS department_name,
  d."firstName",
  d."lastName"
FROM "doctors" AS d
RIGHT JOIN "departments" AS dep ON dep."id" = d."departmentId"
ORDER BY dep."name", d."lastName" NULLS LAST;

-- BQ-C04  FULL OUTER JOIN: patients who gave feedback vs patients who opened queries.
SELECT
  COALESCE(f_p."id", q_p."id") AS patient_id,
  COALESCE(f_p."lastName", q_p."lastName") AS last_name,
  f.feedback_count,
  q.query_count
FROM (
  SELECT "patientId", COUNT(*) AS feedback_count
  FROM "feedback"
  GROUP BY "patientId"
) AS f
FULL OUTER JOIN (
  SELECT "patientId", COUNT(*) AS query_count
  FROM "queries"
  GROUP BY "patientId"
) AS q ON q."patientId" = f."patientId"
LEFT JOIN "patients" AS f_p ON f_p."id" = f."patientId"
LEFT JOIN "patients" AS q_p ON q_p."id" = q."patientId"
ORDER BY last_name;

-- BQ-C05  SELF JOIN: pairs of patients who share a blood group (each pair once).
SELECT
  p1."firstName" AS patient_a,
  p1."lastName" AS last_a,
  p2."firstName" AS patient_b,
  p2."lastName" AS last_b,
  p1."bloodGroup"
FROM "patients" AS p1
INNER JOIN "patients" AS p2
  ON p1."bloodGroup" = p2."bloodGroup"
 AND p1."id" < p2."id"
WHERE p1."bloodGroup" IS NOT NULL
ORDER BY p1."bloodGroup", last_a, last_b;

-- BQ-C06  CROSS JOIN: active doctors × weekday labels, to show roster coverage gaps.
--         Meaningful because availability is stored per dayOfWeek, not per date.
SELECT
  d."lastName" AS doctor_last,
  w.day_of_week,
  w.day_name,
  CASE WHEN av."id" IS NULL THEN 'NO_BLOCK' ELSE 'HAS_BLOCK' END AS coverage
FROM "doctors" AS d
CROSS JOIN (
  SELECT 0 AS day_of_week, 'Monday' AS day_name
  UNION ALL SELECT 1, 'Tuesday'
  UNION ALL SELECT 2, 'Wednesday'
  UNION ALL SELECT 3, 'Thursday'
  UNION ALL SELECT 4, 'Friday'
  UNION ALL SELECT 5, 'Saturday'
  UNION ALL SELECT 6, 'Sunday'
) AS w
LEFT JOIN "doctor_availability" AS av
  ON av."doctorId" = d."id"
 AND av."dayOfWeek" = w.day_of_week
 AND av."isActive" = TRUE
WHERE d."isActive" = TRUE
ORDER BY d."lastName", w.day_of_week;

-- BQ-C07  Multi-join: chat messages with owning patient (conversations + patients).
SELECT
  p."firstName",
  p."lastName",
  c."title",
  m."role",
  m."createdAt",
  LEFT(m."content", 80) AS content_preview
FROM "chat_messages" AS m
INNER JOIN "chat_conversations" AS c ON c."id" = m."conversationId"
INNER JOIN "patients" AS p ON p."id" = c."patientId"
ORDER BY m."createdAt";

-- =============================================================================
-- D. Subqueries
-- =============================================================================

-- BQ-D01  Scalar subquery: each appointment vs hospital-wide average consultation fee.
SELECT
  a."id",
  d."lastName",
  d."consultationFee",
  (SELECT AVG(d2."consultationFee") FROM "doctors" AS d2 WHERE d2."isActive" = TRUE)
    AS hospital_avg_fee
FROM "appointments" AS a
JOIN "doctors" AS d ON d."id" = a."doctorId"
WHERE a."status" = 'COMPLETED'
ORDER BY d."consultationFee" DESC;

-- BQ-D02  Single-row subquery: the doctor with the highest consultation fee
--         (ties broken by id for a deterministic single row).
SELECT
  d."firstName",
  d."lastName",
  d."consultationFee"
FROM "doctors" AS d
WHERE d."id" = (
  SELECT d2."id"
  FROM "doctors" AS d2
  WHERE d2."consultationFee" IS NOT NULL
  ORDER BY d2."consultationFee" DESC, d2."id"
  LIMIT 1
);

-- BQ-D03  Multi-row IN: patients who have at least one COMPLETED appointment.
SELECT
  p."firstName",
  p."lastName"
FROM "patients" AS p
WHERE p."id" IN (
  SELECT a."patientId"
  FROM "appointments" AS a
  WHERE a."status" = 'COMPLETED'
)
ORDER BY p."lastName";

-- BQ-D04  ANY: doctors whose fee is greater than any pediatric fee
--         (i.e. greater than the minimum pediatric fee).
SELECT
  d."firstName",
  d."lastName",
  d."consultationFee"
FROM "doctors" AS d
WHERE d."consultationFee" > ANY (
  SELECT d2."consultationFee"
  FROM "doctors" AS d2
  JOIN "departments" AS dep ON dep."id" = d2."departmentId"
  WHERE dep."name" = 'Pediatrics'
    AND d2."consultationFee" IS NOT NULL
)
ORDER BY d."consultationFee" DESC;

-- BQ-D05  ALL: doctors whose fee is greater than or equal to every dermatology fee.
SELECT
  d."firstName",
  d."lastName",
  d."consultationFee"
FROM "doctors" AS d
WHERE d."consultationFee" >= ALL (
  SELECT d2."consultationFee"
  FROM "doctors" AS d2
  JOIN "departments" AS dep ON dep."id" = d2."departmentId"
  WHERE dep."name" = 'Dermatology'
    AND d2."consultationFee" IS NOT NULL
)
ORDER BY d."consultationFee" DESC;

-- BQ-D06  Correlated subquery: for each doctor, count of non-cancelled future-dated visits.
SELECT
  d."firstName",
  d."lastName",
  (
    SELECT COUNT(*)
    FROM "appointments" AS a
    WHERE a."doctorId" = d."id"
      AND a."appointmentDate" >= DATE '2026-10-01'
      AND a."status" IN ('BOOKED', 'CONFIRMED')
  ) AS upcoming_count
FROM "doctors" AS d
WHERE d."isActive" = TRUE
ORDER BY upcoming_count DESC, d."lastName";

-- BQ-D07  EXISTS: patients who have submitted unread feedback.
SELECT
  p."firstName",
  p."lastName"
FROM "patients" AS p
WHERE EXISTS (
  SELECT 1
  FROM "feedback" AS f
  WHERE f."patientId" = p."id"
    AND f."isRead" = FALSE
)
ORDER BY p."lastName";

-- BQ-D08  NOT EXISTS: departments with no doctors assigned.
SELECT
  dep."id",
  dep."name"
FROM "departments" AS dep
WHERE NOT EXISTS (
  SELECT 1
  FROM "doctors" AS d
  WHERE d."departmentId" = dep."id"
)
ORDER BY dep."name";

-- BQ-D09  NOT IN and the three-valued NULL pitfall.
-- Pitfall: if the subquery returns NULL for any row, NOT IN never returns TRUE
-- for comparisons with NULL (UNKNOWN AND ... stays UNKNOWN). Patients compared
-- with a list that contains NULL therefore disappear incorrectly.
-- Safe pattern: filter NULL out of the subquery, or use NOT EXISTS instead.
--
-- Unsafe shape (do not rely on this if phone can be NULL):
--   WHERE p."phone" NOT IN (SELECT p2."phone" FROM "patients" AS p2)
--
-- Safer: patients who have never booked a given doctor, via NOT IN on non-null ids.
SELECT
  p."firstName",
  p."lastName"
FROM "patients" AS p
WHERE p."id" NOT IN (
  SELECT a."patientId"
  FROM "appointments" AS a
  WHERE a."doctorId" = '00000000-0000-4000-a000-000000000301'
    AND a."patientId" IS NOT NULL
)
ORDER BY p."lastName";

-- =============================================================================
-- E. Set operations
-- =============================================================================
-- Column counts and types of corresponding SELECT lists must match.

-- BQ-E01  UNION: unique patient/source pairs from feedback and queries.
--         The source label means a patient in both sources appears once per source.
SELECT f."patientId" AS patient_id, 'FEEDBACK'::TEXT AS source
FROM "feedback" AS f
UNION
SELECT q."patientId", 'QUERY'::TEXT
FROM "queries" AS q
ORDER BY patient_id, source;

-- BQ-E02  UNION ALL: same lists with duplicate patient/source rows preserved.
--         Repeated feedback or query rows for one patient remain repeated too.
SELECT f."patientId" AS patient_id, 'FEEDBACK'::TEXT AS source
FROM "feedback" AS f
UNION ALL
SELECT q."patientId", 'QUERY'::TEXT
FROM "queries" AS q
ORDER BY patient_id, source;

-- BQ-E03  INTERSECT: patients who both submitted feedback AND opened a query.
SELECT f."patientId" AS patient_id
FROM "feedback" AS f
INTERSECT
SELECT q."patientId"
FROM "queries" AS q
ORDER BY patient_id;

-- BQ-E04  EXCEPT: departments that have no matching doctors
--         (department ids minus department ids referenced by doctors).
SELECT dep."id", dep."name"
FROM "departments" AS dep
WHERE dep."id" IN (
  SELECT d1."id" FROM "departments" AS d1
  EXCEPT
  SELECT d2."departmentId" FROM "doctors" AS d2
)
ORDER BY dep."name";

-- =============================================================================
-- F. Advanced functions
-- =============================================================================

-- BQ-F01  CASE: classify appointment pipeline for operations dashboards.
SELECT
  a."id",
  a."status",
  CASE
    WHEN a."status" IN ('BOOKED', 'CONFIRMED') THEN 'PIPELINE'
    WHEN a."status" = 'COMPLETED' THEN 'DONE'
    ELSE 'CANCELLED'
  END AS pipeline_bucket
FROM "appointments" AS a
ORDER BY a."appointmentDate";

-- BQ-F02  COALESCE: display contact fallback when phone is missing.
SELECT
  p."firstName",
  p."lastName",
  COALESCE(p."phone", 'NO_PHONE_ON_FILE') AS contact_phone,
  COALESCE(p."bloodGroup", 'UNKNOWN') AS blood_group_display
FROM "patients" AS p
ORDER BY p."lastName";

-- BQ-F03  NULLIF: treat empty-looking cancellation reasons as NULL (demo on text).
SELECT
  a."id",
  a."status",
  NULLIF(a."cancellationReason", '') AS cancellation_reason_or_null
FROM "appointments" AS a
WHERE a."status"::TEXT LIKE 'CANCELLED%'
ORDER BY a."appointmentDate";

-- BQ-F04  Date/time: age in years on a fixed census date, and weekday of visits.
SELECT
  p."firstName",
  p."lastName",
  p."dateOfBirth",
  DATE '2026-10-10' AS census_date,
  EXTRACT(YEAR FROM AGE(DATE '2026-10-10', p."dateOfBirth")) AS age_years
FROM "patients" AS p
WHERE p."dateOfBirth" IS NOT NULL
ORDER BY age_years DESC;

-- BQ-F05  Date/time on appointments: month name and ISO weekday.
SELECT
  a."id",
  a."appointmentDate",
  TO_CHAR(a."appointmentDate", 'YYYY-MM') AS year_month,
  TO_CHAR(a."appointmentDate", 'Day') AS weekday_name,
  EXTRACT(ISODOW FROM a."appointmentDate") AS iso_dow
FROM "appointments" AS a
ORDER BY a."appointmentDate";

-- BQ-F06  String functions: email local-part and uppercased names.
SELECT
  u."email",
  SPLIT_PART(u."email", '@', 1) AS email_local_part,
  UPPER(p."lastName") AS last_name_upper,
  LENGTH(p."firstName") AS first_name_length
FROM "patients" AS p
JOIN "users" AS u ON u."id" = p."userId"
ORDER BY p."lastName";

-- BQ-F07  Numeric: fee in rupees vs estimated 18% GST component (display only).
SELECT
  d."firstName",
  d."lastName",
  d."consultationFee",
  ROUND(d."consultationFee" * 0.18, 2) AS gst_component,
  ROUND(d."consultationFee" * 1.18, 2) AS fee_with_gst,
  d."experienceYears",
  d."consultationFee" / NULLIF(d."experienceYears", 0) AS fee_per_year_experience
FROM "doctors" AS d
WHERE d."consultationFee" IS NOT NULL
ORDER BY d."consultationFee" DESC;

-- BQ-F08  CONCAT / TRIM on visit labels.
SELECT
  CONCAT(p."lastName", ', ', p."firstName") AS patient_label,
  TRIM(BOTH FROM a."reasonForVisit") AS reason,
  a."appointmentDate"
FROM "appointments" AS a
JOIN "patients" AS p ON p."id" = a."patientId"
ORDER BY patient_label, a."appointmentDate";

-- =============================================================================
-- G. Window functions
-- =============================================================================

-- BQ-G01  RANK / DENSE_RANK / ROW_NUMBER: doctors ranked by completed visit count.
SELECT
  d."firstName",
  d."lastName",
  dep."name" AS department_name,
  COUNT(*) FILTER (WHERE a."status" = 'COMPLETED') AS completed_visits,
  RANK() OVER (ORDER BY COUNT(*) FILTER (WHERE a."status" = 'COMPLETED') DESC) AS visit_rank,
  DENSE_RANK() OVER (
    PARTITION BY dep."id"
    ORDER BY COUNT(*) FILTER (WHERE a."status" = 'COMPLETED') DESC
  ) AS dept_dense_rank,
  ROW_NUMBER() OVER (ORDER BY d."lastName", d."firstName") AS directory_row
FROM "doctors" AS d
JOIN "departments" AS dep ON dep."id" = d."departmentId"
LEFT JOIN "appointments" AS a ON a."doctorId" = d."id"
GROUP BY d."id", d."firstName", d."lastName", dep."id", dep."name"
ORDER BY completed_visits DESC, d."lastName";

-- BQ-G02  Running total of completed consultation fees in date order.
SELECT
  a."appointmentDate",
  d."lastName" AS doctor_last,
  d."consultationFee",
  SUM(d."consultationFee") OVER (
    ORDER BY a."appointmentDate", a."startTime", a."id"
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_completed_fees
FROM "appointments" AS a
JOIN "doctors" AS d ON d."id" = a."doctorId"
WHERE a."status" = 'COMPLETED'
ORDER BY a."appointmentDate", a."startTime";

-- BQ-G03  LAG: previous visit date for the same patient.
SELECT
  p."lastName",
  a."appointmentDate",
  a."status",
  LAG(a."appointmentDate") OVER (
    PARTITION BY a."patientId"
    ORDER BY a."appointmentDate", a."startTime"
  ) AS previous_visit_date,
  a."appointmentDate" - LAG(a."appointmentDate") OVER (
    PARTITION BY a."patientId"
    ORDER BY a."appointmentDate", a."startTime"
  ) AS days_since_previous
FROM "appointments" AS a
JOIN "patients" AS p ON p."id" = a."patientId"
ORDER BY p."lastName", a."appointmentDate";

-- BQ-G04  LEAD: next scheduled slot for each doctor.
SELECT
  d."lastName",
  a."appointmentDate",
  a."startTime",
  a."status",
  LEAD(a."appointmentDate") OVER (
    PARTITION BY a."doctorId"
    ORDER BY a."appointmentDate", a."startTime"
  ) AS next_appointment_date,
  LEAD(a."startTime") OVER (
    PARTITION BY a."doctorId"
    ORDER BY a."appointmentDate", a."startTime"
  ) AS next_start_time
FROM "appointments" AS a
JOIN "doctors" AS d ON d."id" = a."doctorId"
ORDER BY d."lastName", a."appointmentDate", a."startTime";
