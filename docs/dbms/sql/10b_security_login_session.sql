-- =============================================================================
-- MediCore HMS — restricted LOGIN session (Review 3 security evidence)
-- =============================================================================
-- Run AS medicore_dbms_demo_login (a real login, not SET ROLE), after
-- 10_security.sql, e.g.:
--   docs/dbms/run_dbms_scripts.sh --user medicore_dbms_demo_login \
--     medicore_dbms_test <dbms database> docs/dbms/sql/10b_security_login_session.sql
-- Over TCP, set a password first with \password (see 10_security.sql).
-- Expected permission errors run with ON_ERROR_STOP off so the raw errors are
-- captured.
-- =============================================================================

-- Who am I? session_user is the login itself (no superuser behind it).
SELECT current_user, session_user,
       (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser,
       pg_has_role(current_user, 'medicore_dbms_reporting', 'MEMBER') AS is_reporting,
       pg_has_role(current_user, 'medicore_dbms_operator', 'MEMBER') AS is_operator;

-- Allowed: reporting views.
SELECT appointment_date, start_time, doctor_name, patient_name, status
FROM "vw_dbms_appointment_details"
WHERE status_group = 'ACTIVE'
ORDER BY appointment_date, start_time
LIMIT 5;

SELECT first_name, last_name, specialization FROM "vw_dbms_public_doctor_directory" ORDER BY last_name;

\set ON_ERROR_STOP off
-- Denied: base tables behind the views.
SELECT * FROM "patients" LIMIT 1;
SELECT "email", "passwordHash" FROM "users" LIMIT 1;
SELECT * FROM "appointment_status_audit";
-- Denied: writes.
DELETE FROM "feedback";
-- Denied: procedures and schema changes.
CALL sp_respond_to_query('00000000-0000-4000-a000-000000000702', 'CLOSED');
CREATE TABLE "login_should_not_create" (id INT);
\set ON_ERROR_STOP on

SELECT 'restricted session finished' AS status;
