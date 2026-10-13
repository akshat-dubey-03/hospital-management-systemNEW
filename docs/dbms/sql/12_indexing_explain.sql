-- =============================================================================
-- MediCore HMS — Index review and EXPLAIN comparison (Review 2/3)
-- =============================================================================
-- RUN ONLY ON A DEDICATED DISPOSABLE DATABASE after 01 and 02.
-- It generates ~192,000 synthetic appointments (deterministic ids, re-runnable)
-- so the planner's choices are meaningful; nothing is committed to the repo.
--
-- Business query (patient dashboard, backend/src/modules/dashboard):
--   SELECT ... FROM appointments WHERE "patientId" = $1
--   ORDER BY "appointmentDate", "startTime";
-- Proposed index (migration 20261011140000_dbms_patient_schedule_index):
--   appointments("patientId", "appointmentDate", "startTime")
--   replacing the single-column appointments_patientId_idx.
-- =============================================================================

\timing off
SET jit = off;                              -- keep timings free of JIT compile noise
SET max_parallel_workers_per_gather = 0;    -- single-process plans: easier to compare

-- -----------------------------------------------------------------------------
-- 0. Put the database in the PRE-migration index state (so the script can be
--    re-run and always compares the same two configurations).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "appointments_patientId_idx" ON "appointments"("patientId");
DROP INDEX IF EXISTS "appointments_patientId_appointmentDate_startTime_idx";

-- -----------------------------------------------------------------------------
-- 1. Controlled synthetic data (ids in the ...-c1xx / -c2xx / md5 namespaces).
--    40 doctors x 300 days x 16 fifteen-minute slots = 192,000 appointments,
--    ~96 per patient across 2,000 patients. Every (doctor, date, start) is
--    unique, so the partial unique index is satisfied.
-- -----------------------------------------------------------------------------
INSERT INTO "departments" ("id", "name", "description")
VALUES ('00000000-0000-4000-c000-000000000001', 'Synthetic Load', 'EXPLAIN test data only')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "users" ("id", "email", "passwordHash", "role", "updatedAt")
SELECT ('00000000-0000-4000-c100-' || lpad(n::text, 12, '0'))::uuid,
       'synthetic.doctor.' || n || '@medicore.dbms.example', 'not-a-password', 'DOCTOR'::"Role", now()
FROM generate_series(1, 40) n
UNION ALL
SELECT ('00000000-0000-4000-c200-' || lpad(n::text, 12, '0'))::uuid,
       'synthetic.patient.' || n || '@medicore.dbms.example', 'not-a-password', 'PATIENT'::"Role", now()
FROM generate_series(1, 2000) n
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "doctors" ("id", "userId", "departmentId", "firstName", "lastName",
                       "specialization", "qualification", "slotDurationMinutes", "updatedAt")
SELECT ('00000000-0000-4000-c110-' || lpad(n::text, 12, '0'))::uuid,
       ('00000000-0000-4000-c100-' || lpad(n::text, 12, '0'))::uuid,
       '00000000-0000-4000-c000-000000000001', 'Synthetic', 'Doctor ' || n,
       'Load testing', 'n/a', 15, now()
FROM generate_series(1, 40) n
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "patients" ("id", "userId", "firstName", "lastName", "updatedAt")
SELECT ('00000000-0000-4000-c210-' || lpad(n::text, 12, '0'))::uuid,
       ('00000000-0000-4000-c200-' || lpad(n::text, 12, '0'))::uuid,
       'Synthetic', 'Patient ' || n, now()
FROM generate_series(1, 2000) n
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "appointments" ("id", "patientId", "doctorId", "appointmentDate",
                            "startTime", "endTime", "status", "updatedAt")
SELECT md5('synthetic-appt-' || d || '-' || day || '-' || slot)::uuid,
       ('00000000-0000-4000-c210-' || lpad((((d * 7919 + day * 31 + slot * 17) % 2000) + 1)::text, 12, '0'))::uuid,
       ('00000000-0000-4000-c110-' || lpad(d::text, 12, '0'))::uuid,
       DATE '2026-01-05' + day,
       to_char(TIME '09:00' + slot * INTERVAL '15 minutes', 'HH24:MI'),
       to_char(TIME '09:15' + slot * INTERVAL '15 minutes', 'HH24:MI'),
       (CASE WHEN (d + day + slot) % 10 = 0 THEN 'CANCELLED_BY_PATIENT'
             WHEN DATE '2026-01-05' + day < DATE '2026-10-10' THEN 'COMPLETED'
             ELSE 'BOOKED' END)::"AppointmentStatus",
       now()
FROM generate_series(1, 40) d, generate_series(0, 299) day, generate_series(0, 15) slot
ON CONFLICT ("id") DO NOTHING;

ANALYZE "appointments";
ANALYZE "patients";

-- Data scale and the target patient's row count.
SELECT (SELECT COUNT(*) FROM "appointments") AS appointments,
       (SELECT COUNT(DISTINCT "patientId") FROM "appointments") AS patients_with_appointments,
       (SELECT COUNT(*) FROM "appointments"
        WHERE "patientId" = '00000000-0000-4000-c210-000000000001') AS target_patient_rows;

-- -----------------------------------------------------------------------------
-- 2. BEFORE: current indexes and plan.
-- -----------------------------------------------------------------------------
SELECT indexname, indexdef, pg_size_pretty(pg_relation_size(format('%I', indexname)::regclass)) AS size
FROM pg_indexes WHERE tablename = 'appointments' ORDER BY indexname;

-- Warm the cache once, then measure.
SELECT COUNT(*) FROM "appointments" WHERE "patientId" = '00000000-0000-4000-c210-000000000001';

EXPLAIN (ANALYZE, BUFFERS)
SELECT "id", "appointmentDate", "startTime", "endTime", "status", "doctorId"
FROM "appointments"
WHERE "patientId" = '00000000-0000-4000-c210-000000000001'
ORDER BY "appointmentDate", "startTime";

-- Same query with LIMIT (dashboard "next appointments"): before the index the
-- whole patient set must still be fetched and sorted to return 5 rows.
EXPLAIN (ANALYZE, BUFFERS)
SELECT "id", "appointmentDate", "startTime", "status"
FROM "appointments"
WHERE "patientId" = '00000000-0000-4000-c210-000000000001'
  AND "appointmentDate" >= DATE '2026-10-10'
ORDER BY "appointmentDate", "startTime"
LIMIT 5;

-- -----------------------------------------------------------------------------
-- 3. Apply the migration's change (CREATE first, then DROP), then ANALYZE.
-- -----------------------------------------------------------------------------
CREATE INDEX "appointments_patientId_appointmentDate_startTime_idx"
  ON "appointments"("patientId", "appointmentDate", "startTime");
DROP INDEX "appointments_patientId_idx";
ANALYZE "appointments";

-- -----------------------------------------------------------------------------
-- 4. AFTER: indexes and the same plans.
-- -----------------------------------------------------------------------------
SELECT indexname, pg_size_pretty(pg_relation_size(format('%I', indexname)::regclass)) AS size
FROM pg_indexes WHERE tablename = 'appointments' ORDER BY indexname;

SELECT COUNT(*) FROM "appointments" WHERE "patientId" = '00000000-0000-4000-c210-000000000001';

EXPLAIN (ANALYZE, BUFFERS)
SELECT "id", "appointmentDate", "startTime", "endTime", "status", "doctorId"
FROM "appointments"
WHERE "patientId" = '00000000-0000-4000-c210-000000000001'
ORDER BY "appointmentDate", "startTime";

EXPLAIN (ANALYZE, BUFFERS)
SELECT "id", "appointmentDate", "startTime", "status"
FROM "appointments"
WHERE "patientId" = '00000000-0000-4000-c210-000000000001'
  AND "appointmentDate" >= DATE '2026-10-10'
ORDER BY "appointmentDate", "startTime"
LIMIT 5;

-- -----------------------------------------------------------------------------
-- 5. Leftmost-prefix behaviour and legitimate sequential scans.
-- -----------------------------------------------------------------------------
-- 5a. patientId alone (e.g. the FK check when deleting a patient) still uses
--     the composite index through its leftmost column.
EXPLAIN (COSTS OFF)
SELECT 1 FROM "appointments" WHERE "patientId" = '00000000-0000-4000-c210-000000000002';

-- 5b. A predicate on appointmentDate alone cannot use the composite index
--     (not its leftmost column); the existing appointmentDate index is used.
EXPLAIN (COSTS OFF)
SELECT COUNT(*) FROM "appointments" WHERE "appointmentDate" = DATE '2026-03-02';

-- 5c. Admin dashboard count of active appointments: the predicate matches a
--     large share of the table, so a sequential scan is the right plan; no
--     status index is proposed.
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT COUNT(*) FROM "appointments" WHERE "status" IN ('BOOKED', 'CONFIRMED');
