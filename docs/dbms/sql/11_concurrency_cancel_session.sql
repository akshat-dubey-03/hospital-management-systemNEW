-- Concurrency demo — two sessions cancelling the SAME appointment (510)
-- through sp_cancel_appointment. The procedure locks the row with
-- SELECT ... FOR UPDATE, so the second caller waits for the first to finish,
-- then sees the new status and is refused (55000) instead of overwriting it.
-- psql variables: -v who=A|B  -v hold=<seconds to keep the transaction open>
\set ON_ERROR_STOP off
SELECT :'who' AS session, pg_backend_pid() AS pid, to_char(clock_timestamp(), 'HH24:MI:SS.MS') AS at;
BEGIN;
CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000510', 'CANCELLED_BY_ADMIN',
                           'Concurrency demo ' || :'who', TIMESTAMPTZ '2026-10-10 09:00+00');
SELECT :'who' AS session, 'cancel succeeded' AS outcome, to_char(clock_timestamp(), 'HH24:MI:SS.MS') AS at;
SELECT pg_sleep(:hold);
COMMIT;
SELECT :'who' AS session, 'transaction ended' AS outcome, to_char(clock_timestamp(), 'HH24:MI:SS.MS') AS at;
