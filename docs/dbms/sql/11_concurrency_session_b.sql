-- Concurrency demo — SESSION B (start ~1 s after session A).
-- Tries to book exactly the same doctor/date/startTime (fixture id ...05c2).
-- While A's insert is uncommitted, B's insert must WAIT on the unique index
-- entry; once A commits, B fails with unique_violation (23505); once A rolls
-- back, B succeeds.
\set ON_ERROR_STOP off
SELECT 'B' AS session, pg_backend_pid() AS pid, to_char(clock_timestamp(), 'HH24:MI:SS.MS') AS at;
BEGIN;
INSERT INTO "appointments" ("id", "patientId", "doctorId", "appointmentDate", "startTime", "endTime", "status", "reasonForVisit", "updatedAt")
VALUES ('00000000-0000-4000-a000-0000000005c2', '00000000-0000-4000-a000-000000000202',
        '00000000-0000-4000-a000-000000000306', DATE '2026-12-04', '10:00', '10:30', 'BOOKED',
        'Concurrency demo - session B', now());
COMMIT;
SELECT 'B finished' AS session_b, to_char(clock_timestamp(), 'HH24:MI:SS.MS') AS at;
