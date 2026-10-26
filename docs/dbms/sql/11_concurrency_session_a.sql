-- Concurrency demo — SESSION A (run concurrently with session B).
-- Books Dr Rao, Friday 2026-12-04 10:00 (test-only fixture id ...05c1), holds
-- the transaction open for :hold seconds, then ends it with :finish
-- (COMMIT or ROLLBACK). psql variables: -v hold=4 -v finish=COMMIT
\set ON_ERROR_STOP on
SELECT 'A' AS session, pg_backend_pid() AS pid, current_setting('transaction_isolation') AS isolation,
       to_char(clock_timestamp(), 'HH24:MI:SS.MS') AS at;
BEGIN;
INSERT INTO "appointments" ("id", "patientId", "doctorId", "appointmentDate", "startTime", "endTime", "status", "reasonForVisit", "updatedAt")
VALUES ('00000000-0000-4000-a000-0000000005c1', '00000000-0000-4000-a000-000000000201',
        '00000000-0000-4000-a000-000000000306', DATE '2026-12-04', '10:00', '10:30', 'BOOKED',
        'Concurrency demo - session A', now());
SELECT 'A inserted, NOT yet committed' AS session_a, to_char(clock_timestamp(), 'HH24:MI:SS.MS') AS at;
SELECT pg_sleep(:hold);
:finish;
SELECT 'A ended with ' || :'finish' AS session_a, to_char(clock_timestamp(), 'HH24:MI:SS.MS') AS at;
