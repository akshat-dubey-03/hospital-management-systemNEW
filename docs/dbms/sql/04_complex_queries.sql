-- =============================================================================
-- MediCore HMS — Ten complex business queries (CQ-01 … CQ-10)
-- =============================================================================
-- Each query uses at least three tables and/or nested/analytic logic.
-- Expected output describes *structure*, not executed cell values.
-- Result values are UNVERIFIED (SQL was not run against PostgreSQL here).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CQ-01  Department load and cancellation mix
-- -----------------------------------------------------------------------------
-- Business question:
--   For each department, how many appointments were completed, still in the
--   pipeline, or cancelled, and which doctors contribute to that load?
--
-- Expected output structure (unverified):
--   One row per department that has at least one doctor. Columns:
--   department_name, doctor_count, completed_count, pipeline_count,
--   cancelled_count, completion_rate_pct.
--
-- Explanation:
--   departments ⋈ doctors ⋈ appointments. Aggregation is by department.
--   FILTER counts replace extra CASE wrappers. Departments with no doctors
--   (Oncology in the demo set) are excluded by INNER JOIN to doctors.

SELECT
  dep."name" AS department_name,
  COUNT(DISTINCT d."id") AS doctor_count,
  COUNT(*) FILTER (WHERE a."status" = 'COMPLETED') AS completed_count,
  COUNT(*) FILTER (WHERE a."status" IN ('BOOKED', 'CONFIRMED')) AS pipeline_count,
  COUNT(*) FILTER (
    WHERE a."status" IN (
      'CANCELLED_BY_PATIENT',
      'CANCELLED_BY_DOCTOR',
      'CANCELLED_BY_ADMIN'
    )
  ) AS cancelled_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE a."status" = 'COMPLETED')
      / NULLIF(COUNT(a."id"), 0),
    1
  ) AS completion_rate_pct
FROM "departments" AS dep
INNER JOIN "doctors" AS d ON d."departmentId" = dep."id"
LEFT JOIN "appointments" AS a ON a."doctorId" = d."id"
GROUP BY dep."id", dep."name"
ORDER BY pipeline_count DESC, dep."name";

-- -----------------------------------------------------------------------------
-- CQ-02  Patient 360: identity, last completed visit, next pipeline visit
-- -----------------------------------------------------------------------------
-- Business question:
--   For each patient, what is the most recent completed encounter (doctor and
--   department) and the next booked/confirmed visit?
--
-- Expected output structure (unverified):
--   One row per patient. Nullable last_* and next_* columns when history or
--   pipeline is empty (e.g. patient Iyer may have only a future booking).
--
-- Explanation:
--   Nested correlated subqueries pick the latest COMPLETED and earliest
--   pipeline appointment ids, then join patients → appointments → doctors →
--   departments. Three-plus tables plus nested lookups.

SELECT
  p."id" AS patient_id,
  p."firstName",
  p."lastName",
  u."email",
  last_a."appointmentDate" AS last_completed_date,
  last_d."lastName" AS last_doctor_last,
  last_dep."name" AS last_department,
  next_a."appointmentDate" AS next_visit_date,
  next_a."startTime" AS next_start_time,
  next_d."lastName" AS next_doctor_last,
  next_dep."name" AS next_department
FROM "patients" AS p
INNER JOIN "users" AS u ON u."id" = p."userId"
LEFT JOIN "appointments" AS last_a
  ON last_a."id" = (
    SELECT a1."id"
    FROM "appointments" AS a1
    WHERE a1."patientId" = p."id"
      AND a1."status" = 'COMPLETED'
    ORDER BY a1."appointmentDate" DESC, a1."startTime" DESC, a1."id" DESC
    LIMIT 1
  )
LEFT JOIN "doctors" AS last_d ON last_d."id" = last_a."doctorId"
LEFT JOIN "departments" AS last_dep ON last_dep."id" = last_d."departmentId"
LEFT JOIN "appointments" AS next_a
  ON next_a."id" = (
    SELECT a2."id"
    FROM "appointments" AS a2
    WHERE a2."patientId" = p."id"
      AND a2."status" IN ('BOOKED', 'CONFIRMED')
      AND a2."appointmentDate" >= DATE '2026-10-01'
    ORDER BY a2."appointmentDate", a2."startTime", a2."id"
    LIMIT 1
  )
LEFT JOIN "doctors" AS next_d ON next_d."id" = next_a."doctorId"
LEFT JOIN "departments" AS next_dep ON next_dep."id" = next_d."departmentId"
ORDER BY p."lastName", p."firstName";

-- -----------------------------------------------------------------------------
-- CQ-03  Completed-care consultation-fee estimate by department and month
-- -----------------------------------------------------------------------------
-- Business question:
--   What consultation-fee total would completed visits represent if each
--   completed appointment is billed at the doctor’s current consultationFee?
--
-- Expected output structure (unverified):
--   Rows at department × year-month grain with visit_count and fee_total.
--   Demo completed visits fall in 2026-08 and 2026-09.
--
-- Explanation:
--   appointments ⋈ doctors ⋈ departments. WHERE keeps COMPLETED only.
--   Fee lives on doctors (no invoice table exists in the current schema).

SELECT
  dep."name" AS department_name,
  TO_CHAR(a."appointmentDate", 'YYYY-MM') AS year_month,
  COUNT(*) AS completed_visits,
  SUM(d."consultationFee") AS fee_total,
  AVG(d."consultationFee") AS avg_fee
FROM "appointments" AS a
INNER JOIN "doctors" AS d ON d."id" = a."doctorId"
INNER JOIN "departments" AS dep ON dep."id" = d."departmentId"
WHERE a."status" = 'COMPLETED'
GROUP BY dep."name", TO_CHAR(a."appointmentDate", 'YYYY-MM')
ORDER BY year_month, department_name;

-- -----------------------------------------------------------------------------
-- CQ-04  Patients with unread feedback who also have an open/in-progress query
-- -----------------------------------------------------------------------------
-- Business question:
--   Which patients need both a feedback follow-up and an active support ticket,
--   and which doctor did they last see?
--
-- Expected output structure (unverified):
--   Patient name, unread_feedback_count, open_query_subjects (aggregated),
--   last doctor/department if any completed appointment exists.
--
-- Explanation:
--   INTERSECT of patient ids from feedback and queries, then joins to
--   patients, users, and a nested last-appointment lookup through doctors
--   and departments.

SELECT
  p."firstName",
  p."lastName",
  u."email",
  (
    SELECT COUNT(*)
    FROM "feedback" AS f
    WHERE f."patientId" = p."id" AND f."isRead" = FALSE
  ) AS unread_feedback_count,
  (
    SELECT STRING_AGG(q."subject", ' | ' ORDER BY q."createdAt")
    FROM "queries" AS q
    WHERE q."patientId" = p."id"
      AND q."status" IN ('OPEN', 'IN_PROGRESS')
  ) AS active_query_subjects,
  d."lastName" AS last_doctor_last,
  dep."name" AS last_department
FROM "patients" AS p
INNER JOIN "users" AS u ON u."id" = p."userId"
LEFT JOIN "appointments" AS last_a
  ON last_a."id" = (
    SELECT a."id"
    FROM "appointments" AS a
    WHERE a."patientId" = p."id"
      AND a."status" = 'COMPLETED'
    ORDER BY a."appointmentDate" DESC, a."startTime" DESC, a."id" DESC
    LIMIT 1
  )
LEFT JOIN "doctors" AS d ON d."id" = last_a."doctorId"
LEFT JOIN "departments" AS dep ON dep."id" = d."departmentId"
WHERE p."id" IN (
  SELECT f."patientId"
  FROM "feedback" AS f
  WHERE f."isRead" = FALSE
  INTERSECT
  SELECT q."patientId"
  FROM "queries" AS q
  WHERE q."status" IN ('OPEN', 'IN_PROGRESS')
)
ORDER BY p."lastName";

-- -----------------------------------------------------------------------------
-- CQ-05  Idle active doctors (no pipeline appointments) with availability
-- -----------------------------------------------------------------------------
-- Business question:
--   Which active doctors have weekly availability blocks but no BOOKED or
--   CONFIRMED appointments on or after 2026-10-01?
--
-- Expected output structure (unverified):
--   Doctor name, department, count of active availability blocks.
--   Inactive Dr Gupta should not appear (isActive = false).
--
-- Explanation:
--   NOT EXISTS correlated anti-join on appointments; doctors ⋈ departments
--   and an aggregate of doctor_availability.

SELECT
  d."firstName",
  d."lastName",
  dep."name" AS department_name,
  COUNT(av."id") AS active_blocks
FROM "doctors" AS d
INNER JOIN "departments" AS dep ON dep."id" = d."departmentId"
LEFT JOIN "doctor_availability" AS av
  ON av."doctorId" = d."id"
 AND av."isActive" = TRUE
WHERE d."isActive" = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM "appointments" AS a
    WHERE a."doctorId" = d."id"
      AND a."status" IN ('BOOKED', 'CONFIRMED')
      AND a."appointmentDate" >= DATE '2026-10-01'
  )
GROUP BY d."id", d."firstName", d."lastName", dep."name"
ORDER BY d."lastName";

-- -----------------------------------------------------------------------------
-- CQ-06  Chat engagement versus clinical visits
-- -----------------------------------------------------------------------------
-- Business question:
--   Do patients who use the AI assistant also have more appointments, and how
--   many tokens did those chats consume?
--
-- Expected output structure (unverified):
--   One row per patient: conversation_count, message_count, token_sum,
--   appointment_count. Patients with neither chats nor visits still appear
--   with zeros because of LEFT JOINs and COUNT on nullable ids.
--
-- Explanation:
--   Chat/message statistics and appointment counts are aggregated separately
--   before joining them to patients. This avoids join fan-out: joining messages
--   directly to appointments would multiply each message by each appointment.

WITH patient_chat_stats AS (
  SELECT
    c."patientId",
    COUNT(DISTINCT c."id") AS conversation_count,
    COUNT(m."id") AS message_count,
    COALESCE(SUM(m."tokenCount"), 0) AS token_sum
  FROM "chat_conversations" AS c
  LEFT JOIN "chat_messages" AS m ON m."conversationId" = c."id"
  GROUP BY c."patientId"
),
patient_appointment_stats AS (
  SELECT
    a."patientId",
    COUNT(*) AS appointment_count
  FROM "appointments" AS a
  GROUP BY a."patientId"
)
SELECT
  p."firstName",
  p."lastName",
  COALESCE(cs.conversation_count, 0) AS conversation_count,
  COALESCE(cs.message_count, 0) AS message_count,
  COALESCE(cs.token_sum, 0) AS token_sum,
  COALESCE(aps.appointment_count, 0) AS appointment_count
FROM "patients" AS p
LEFT JOIN patient_chat_stats AS cs ON cs."patientId" = p."id"
LEFT JOIN patient_appointment_stats AS aps ON aps."patientId" = p."id"
ORDER BY message_count DESC, p."lastName";

-- -----------------------------------------------------------------------------
-- CQ-07  Patients with appointments across multiple departments
-- -----------------------------------------------------------------------------
-- Business question:
--   Which patients have non-cancelled appointments with doctors from two or
--   more departments, and which specialties are involved?
--
-- Expected output structure (unverified):
--   Patient name, department_count >= 2, aggregated department names.
--   Rahul Kumar is set up with Cardiology and Orthopedics visits in demo DML.
--
-- Explanation:
--   patients ⋈ appointments ⋈ doctors ⋈ departments. HAVING COUNT(DISTINCT
--   departmentId) >= 2. Nested STRING_AGG over distinct department names.

SELECT
  p."firstName",
  p."lastName",
  COUNT(DISTINCT dep."id") AS department_count,
  STRING_AGG(DISTINCT dep."name", ', ' ORDER BY dep."name") AS departments_seen
FROM "patients" AS p
INNER JOIN "appointments" AS a ON a."patientId" = p."id"
INNER JOIN "doctors" AS d ON d."id" = a."doctorId"
INNER JOIN "departments" AS dep ON dep."id" = d."departmentId"
WHERE a."status" NOT IN (
  'CANCELLED_BY_PATIENT',
  'CANCELLED_BY_DOCTOR',
  'CANCELLED_BY_ADMIN'
)
GROUP BY p."id", p."firstName", p."lastName"
HAVING COUNT(DISTINCT dep."id") >= 2
ORDER BY department_count DESC, p."lastName";

-- -----------------------------------------------------------------------------
-- CQ-08  Cancellation accountability by actor and department
-- -----------------------------------------------------------------------------
-- Business question:
--   How many cancellations were initiated by patient, doctor, or admin in each
--   department, and what share is that of all of that department’s appointments?
--
-- Expected output structure (unverified):
--   department_name, patient_cancels, doctor_cancels, admin_cancels,
--   total_appointments, cancel_share_pct.
--
-- Explanation:
--   FILTER aggregation across appointments ⋈ doctors ⋈ departments.

SELECT
  dep."name" AS department_name,
  COUNT(*) FILTER (WHERE a."status" = 'CANCELLED_BY_PATIENT') AS patient_cancels,
  COUNT(*) FILTER (WHERE a."status" = 'CANCELLED_BY_DOCTOR') AS doctor_cancels,
  COUNT(*) FILTER (WHERE a."status" = 'CANCELLED_BY_ADMIN') AS admin_cancels,
  COUNT(a."id") AS total_appointments,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE a."status" IN (
        'CANCELLED_BY_PATIENT',
        'CANCELLED_BY_DOCTOR',
        'CANCELLED_BY_ADMIN'
      )
    ) / NULLIF(COUNT(a."id"), 0),
    1
  ) AS cancel_share_pct
FROM "departments" AS dep
INNER JOIN "doctors" AS d ON d."departmentId" = dep."id"
LEFT JOIN "appointments" AS a ON a."doctorId" = d."id"
GROUP BY dep."id", dep."name"
HAVING COUNT(a."id") > 0
ORDER BY cancel_share_pct DESC, dep."name";

-- -----------------------------------------------------------------------------
-- CQ-09  Same-day doctor schedule with previous/next patient (analytic)
-- -----------------------------------------------------------------------------
-- Business question:
--   For a chosen clinic date, what is each doctor’s ordered list of patients
--   and who comes immediately before and after in that doctor’s day?
--
-- Expected output structure (unverified):
--   For DATE '2026-10-15', Dr Sharma has two non-cancelled demo slots:
--   Kumar at 10:00 and Patel at 10:30. LAG/LEAD should link these rows in
--   chronological order. Change the date predicate to inspect another day.
--
-- Explanation:
--   Window functions PARTITION BY doctorId ORDER BY startTime, joined to
--   patients, doctors, and departments (four tables).

SELECT
  a."appointmentDate",
  d."lastName" AS doctor_last,
  dep."name" AS department_name,
  a."startTime",
  a."endTime",
  a."status",
  p."lastName" AS patient_last,
  LAG(p."lastName") OVER (
    PARTITION BY a."doctorId", a."appointmentDate"
    ORDER BY a."startTime"
  ) AS previous_patient_last,
  LEAD(p."lastName") OVER (
    PARTITION BY a."doctorId", a."appointmentDate"
    ORDER BY a."startTime"
  ) AS next_patient_last
FROM "appointments" AS a
INNER JOIN "patients" AS p ON p."id" = a."patientId"
INNER JOIN "doctors" AS d ON d."id" = a."doctorId"
INNER JOIN "departments" AS dep ON dep."id" = d."departmentId"
WHERE a."appointmentDate" = DATE '2026-10-15'
  AND a."status" NOT IN (
    'CANCELLED_BY_PATIENT',
    'CANCELLED_BY_DOCTOR',
    'CANCELLED_BY_ADMIN'
  )
ORDER BY a."appointmentDate", doctor_last, a."startTime";

-- -----------------------------------------------------------------------------
-- CQ-10  Completed visits with doctor fees above the active-doctor average
-- -----------------------------------------------------------------------------
-- Business question:
--   Which completed visits belong to doctors whose current consultation fee
--   exceeds the average fee among active doctors, and when was that doctor’s
--   previous completed visit? The schema has no invoice/billing table.
--
-- Expected output structure (unverified):
--   One row per COMPLETED appointment above the active-doctor average fee, with
--   consultationFee, hospital_avg_fee, fee_minus_avg, and the prior completed
--   visit date for that doctor.
--
-- Explanation:
--   Scalar subquery for AVG(consultationFee) of active doctors; three-table
--   join; LAG window per doctor. Demonstrates nested + analytic together.

SELECT
  a."appointmentDate",
  p."lastName" AS patient_last,
  d."lastName" AS doctor_last,
  dep."name" AS department_name,
  d."consultationFee",
  ROUND(
    (SELECT AVG(d2."consultationFee") FROM "doctors" AS d2 WHERE d2."isActive" = TRUE),
    2
  ) AS hospital_avg_fee,
  d."consultationFee" - (
    SELECT AVG(d3."consultationFee") FROM "doctors" AS d3 WHERE d3."isActive" = TRUE
  ) AS fee_minus_avg,
  LAG(a."appointmentDate") OVER (
    PARTITION BY d."id"
    ORDER BY a."appointmentDate", a."startTime"
  ) AS doctor_previous_completed_date
FROM "appointments" AS a
INNER JOIN "patients" AS p ON p."id" = a."patientId"
INNER JOIN "doctors" AS d ON d."id" = a."doctorId"
INNER JOIN "departments" AS dep ON dep."id" = d."departmentId"
WHERE a."status" = 'COMPLETED'
  AND d."consultationFee" > (
    SELECT AVG(d4."consultationFee") FROM "doctors" AS d4 WHERE d4."isActive" = TRUE
  )
ORDER BY a."appointmentDate", doctor_last;
