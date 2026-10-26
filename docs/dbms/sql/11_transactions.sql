-- =============================================================================
-- MediCore HMS — Transactions: COMMIT, ROLLBACK, SAVEPOINT, failure (Review 2/3)
-- =============================================================================
-- Run on a disposable database after 01, 02, 06, 07 and 08.
-- Only known demo rows (02_dml.sql) are touched. Anything committed for the
-- demonstration is restored at the end, so the script can be re-run.
-- Deliberate errors run with ON_ERROR_STOP off so the raw error is captured.
-- =============================================================================

-- Default isolation level (PostgreSQL's default; not changed by this script).
SHOW transaction_isolation;

-- -----------------------------------------------------------------------------
-- TX-1  BEGIN ... COMMIT: a controlled change becomes permanent.
-- -----------------------------------------------------------------------------
SELECT "id", "subject", "isRead" FROM "feedback" WHERE "id" = '00000000-0000-4000-a000-000000000603';

BEGIN;
UPDATE "feedback" SET "isRead" = TRUE WHERE "id" = '00000000-0000-4000-a000-000000000603';
COMMIT;

-- After COMMIT the change is visible to every later transaction.
SELECT "id", "subject", "isRead" FROM "feedback" WHERE "id" = '00000000-0000-4000-a000-000000000603';

-- -----------------------------------------------------------------------------
-- TX-2  SAVEPOINT: keep the good part, undo the failed / unwanted part.
-- -----------------------------------------------------------------------------
SELECT "id", "status" FROM "queries" WHERE "id" = '00000000-0000-4000-a000-000000000702';

BEGIN;
-- Wanted change.
UPDATE "queries" SET "status" = 'IN_PROGRESS', "updatedAt" = now()
WHERE "id" = '00000000-0000-4000-a000-000000000702';

SAVEPOINT before_bad_insert;
-- Intentional failure: rating 9 violates feedback_rating_range_chk.
\set ON_ERROR_STOP off
INSERT INTO "feedback" ("patientId", "subject", "message", "rating")
VALUES ('00000000-0000-4000-a000-000000000204', 'TX-2', 'invalid rating', 9);
-- The transaction is now aborted: even a harmless query fails until we roll back.
SELECT 1 AS this_fails_while_aborted;
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT before_bad_insert;   -- transaction usable again

SAVEPOINT before_unwanted_change;
-- Unwanted (but valid) change, undone by choice.
DELETE FROM "chat_messages" WHERE "conversationId" = '00000000-0000-4000-a000-000000000801';
SELECT COUNT(*) AS messages_after_delete FROM "chat_messages"
WHERE "conversationId" = '00000000-0000-4000-a000-000000000801';
ROLLBACK TO SAVEPOINT before_unwanted_change;

COMMIT;

-- Result: the wanted UPDATE committed; the failed INSERT and the DELETE did not.
SELECT (SELECT "status" FROM "queries" WHERE "id" = '00000000-0000-4000-a000-000000000702') AS query_702_status,
       (SELECT COUNT(*) FROM "feedback" WHERE "subject" = 'TX-2') AS tx2_feedback_rows,
       (SELECT COUNT(*) FROM "chat_messages"
        WHERE "conversationId" = '00000000-0000-4000-a000-000000000801') AS conversation_801_messages;

-- -----------------------------------------------------------------------------
-- TX-3  Full ROLLBACK restores the starting data.
-- -----------------------------------------------------------------------------
SELECT (SELECT COUNT(*) FROM "appointments") AS appointments_before,
       (SELECT COUNT(*) FROM "appointments" WHERE "status" = 'BOOKED') AS booked_before;

BEGIN;
UPDATE "appointments" SET "status" = 'CONFIRMED', "updatedAt" = now() WHERE "status" = 'BOOKED';
DELETE FROM "appointments" WHERE "status" = 'CANCELLED_BY_ADMIN';
SELECT (SELECT COUNT(*) FROM "appointments") AS appointments_inside,
       (SELECT COUNT(*) FROM "appointments" WHERE "status" = 'BOOKED') AS booked_inside,
       (SELECT COUNT(*) FROM "appointment_status_audit") AS audit_rows_inside;
ROLLBACK;

SELECT (SELECT COUNT(*) FROM "appointments") AS appointments_after,
       (SELECT COUNT(*) FROM "appointments" WHERE "status" = 'BOOKED') AS booked_after,
       (SELECT COUNT(*) FROM "appointment_status_audit") AS audit_rows_after;

-- -----------------------------------------------------------------------------
-- TX-4  A failing procedure call aborts the whole transaction (atomicity).
--       The first cancel succeeds, the second is refused (appointment 501 is
--       COMPLETED); COMMIT on an aborted transaction performs a ROLLBACK, so
--       the first cancel is undone too.
-- -----------------------------------------------------------------------------
BEGIN;
CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000511', 'CANCELLED_BY_DOCTOR',
                           'Doctor on leave', TIMESTAMPTZ '2026-10-10 09:00+00');
SELECT "status" AS appt_511_inside FROM "appointments" WHERE "id" = '00000000-0000-4000-a000-000000000511';
\set ON_ERROR_STOP off
CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000501', 'CANCELLED_BY_DOCTOR',
                           'Doctor on leave', TIMESTAMPTZ '2026-10-10 09:00+00');
COMMIT;   -- reported as ROLLBACK
\set ON_ERROR_STOP on

SELECT "status" AS appt_511_after, "cancelledAt" FROM "appointments"
WHERE "id" = '00000000-0000-4000-a000-000000000511';

-- -----------------------------------------------------------------------------
-- TX-5  Cancelled slots are rebookable; active duplicates are not.
--       The partial unique index covers only non-cancelled rows.
-- -----------------------------------------------------------------------------
BEGIN;
-- 506 is CANCELLED_BY_DOCTOR for Dr Sharma, 2026-09-14 09:00: rebooking is allowed.
INSERT INTO "appointments" ("id", "patientId", "doctorId", "appointmentDate", "startTime", "endTime", "status", "updatedAt")
VALUES ('00000000-0000-4000-a000-0000000005d1', '00000000-0000-4000-a000-000000000203',
        '00000000-0000-4000-a000-000000000301', DATE '2026-09-14', '09:00', '09:30', 'BOOKED', now());
SAVEPOINT s;
\set ON_ERROR_STOP off
-- A second ACTIVE booking of that same slot is rejected.
INSERT INTO "appointments" ("id", "patientId", "doctorId", "appointmentDate", "startTime", "endTime", "status", "updatedAt")
VALUES ('00000000-0000-4000-a000-0000000005d2', '00000000-0000-4000-a000-000000000204',
        '00000000-0000-4000-a000-000000000301', DATE '2026-09-14', '09:00', '09:30', 'BOOKED', now());
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT s;
-- Limitation: an OVERLAPPING active slot with a different start time is NOT
-- blocked by the index (it only compares doctorId, date, startTime).
INSERT INTO "appointments" ("id", "patientId", "doctorId", "appointmentDate", "startTime", "endTime", "status", "updatedAt")
VALUES ('00000000-0000-4000-a000-0000000005d3', '00000000-0000-4000-a000-000000000204',
        '00000000-0000-4000-a000-000000000301', DATE '2026-09-14', '09:15', '09:45', 'BOOKED', now());
SELECT "startTime", "endTime", "status" FROM "appointments"
WHERE "doctorId" = '00000000-0000-4000-a000-000000000301' AND "appointmentDate" = DATE '2026-09-14'
ORDER BY "startTime", "status";
ROLLBACK;

-- -----------------------------------------------------------------------------
-- Restore the TX-1 / TX-2 committed demo changes so the script is re-runnable
-- and 02_dml.sql state is back.
-- -----------------------------------------------------------------------------
BEGIN;
UPDATE "feedback" SET "isRead" = FALSE WHERE "id" = '00000000-0000-4000-a000-000000000603';
UPDATE "queries"  SET "status" = 'OPEN', "updatedAt" = TIMESTAMPTZ '2026-10-01 11:00:00+00'
WHERE "id" = '00000000-0000-4000-a000-000000000702';
COMMIT;

SELECT (SELECT "isRead" FROM "feedback" WHERE "id" = '00000000-0000-4000-a000-000000000603') AS feedback_603_isread,
       (SELECT "status" FROM "queries" WHERE "id" = '00000000-0000-4000-a000-000000000702') AS query_702,
       (SELECT "status" FROM "appointments" WHERE "id" = '00000000-0000-4000-a000-000000000511') AS appt_511,
       (SELECT COUNT(*) FROM "appointments") AS appointments;
