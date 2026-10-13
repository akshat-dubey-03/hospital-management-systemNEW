-- =============================================================================
-- MediCore HMS — SQL security: roles, GRANT/REVOKE, least privilege (Review 3)
-- =============================================================================
-- RUN ONLY ON A DISPOSABLE DBMS DATABASE (e.g. medicore_dbms_*), as a
-- superuser, after 01, 02, 06, 07 and 08. Never on medicore_db: this script
-- revokes PUBLIC access to the public schema of the database it runs in.
-- The application's medicore_user is not created, altered or referenced.
--
-- Roles are cluster-wide in PostgreSQL; the role creation block is idempotent
-- (PostgreSQL has no CREATE ROLE IF NOT EXISTS). Grants are per database and
-- GRANT/REVOKE are naturally repeatable.
--
-- NO PASSWORDS are set here. The demo login connects through the container's
-- local socket (trust authentication in the official postgres image). To log
-- in over TCP, set a password interactively in psql:
--     \password medicore_dbms_demo_login
-- then:  psql -h <host> -U medicore_dbms_demo_login -d <dbms database>
--
-- Expected permission errors are executed with ON_ERROR_STOP temporarily off,
-- so the raw PostgreSQL "permission denied" output is captured as evidence.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Roles (idempotent). Group roles are NOLOGIN; none is SUPERUSER,
--    CREATEDB, CREATEROLE or BYPASSRLS.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('medicore_dbms_admin',      FALSE),
      ('medicore_dbms_reporting',  FALSE),
      ('medicore_dbms_operator',   FALSE),
      ('medicore_dbms_demo_login', TRUE)) AS v(name, can_login)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.name) THEN
      EXECUTE format('CREATE ROLE %I %s NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT',
                     r.name, CASE WHEN r.can_login THEN 'LOGIN' ELSE 'NOLOGIN' END);
      RAISE NOTICE 'created role %', r.name;
    ELSE
      RAISE NOTICE 'role % already exists (kept)', r.name;
    END IF;
  END LOOP;
END $$;

COMMENT ON ROLE medicore_dbms_admin      IS 'DBMS demo: data administrator — DML on base tables, read-only audit, no DDL.';
COMMENT ON ROLE medicore_dbms_reporting  IS 'DBMS demo: read-only reporting through vw_dbms_* views only.';
COMMENT ON ROLE medicore_dbms_operator   IS 'DBMS demo: workflow operator — may only change data through the stored procedures.';
COMMENT ON ROLE medicore_dbms_demo_login IS 'DBMS demo: restricted login account used to prove allowed/denied access.';

-- -----------------------------------------------------------------------------
-- 2. Lock down PUBLIC in this database. PostgreSQL 15 grants USAGE on schema
--    public and EXECUTE on functions to PUBLIC by default.
-- -----------------------------------------------------------------------------
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 3. Grants (no GRANT ALL anywhere).
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO medicore_dbms_admin, medicore_dbms_reporting, medicore_dbms_operator;

-- admin: read/write data, but no DDL (no CREATE on schema), no TRUNCATE,
-- REFERENCES or TRIGGER, and the audit table is read-only.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "users", "patients", "departments", "doctors", "doctor_availability",
  "appointments", "feedback", "queries", "chat_conversations", "chat_messages"
  TO medicore_dbms_admin;
GRANT SELECT ON "appointment_status_audit" TO medicore_dbms_admin;
GRANT SELECT ON "vw_dbms_appointment_details", "vw_dbms_doctor_appointment_stats",
                "vw_dbms_public_doctor_directory" TO medicore_dbms_admin;
GRANT EXECUTE ON PROCEDURE sp_cancel_appointment(UUID, "AppointmentStatus", TEXT, TIMESTAMPTZ),
                           sp_respond_to_query(UUID, "QueryStatus", TEXT) TO medicore_dbms_admin;
GRANT EXECUTE ON FUNCTION fn_doctor_completed_count(UUID),
                          fn_patient_upcoming_count(UUID, DATE) TO medicore_dbms_admin;

-- reporting: the three views only. Views run with their owner's rights, so
-- no base-table privilege is needed — and none is granted.
GRANT SELECT ON "vw_dbms_appointment_details", "vw_dbms_doctor_appointment_stats",
                "vw_dbms_public_doctor_directory" TO medicore_dbms_reporting;

-- operator: change data ONLY through the SECURITY DEFINER procedures; may look
-- appointments up through the detail view. No INSERT/UPDATE/DELETE anywhere.
GRANT EXECUTE ON PROCEDURE sp_cancel_appointment(UUID, "AppointmentStatus", TEXT, TIMESTAMPTZ),
                           sp_respond_to_query(UUID, "QueryStatus", TEXT) TO medicore_dbms_operator;
GRANT SELECT ON "vw_dbms_appointment_details" TO medicore_dbms_operator;

-- demo login starts as a reporting user only.
GRANT medicore_dbms_reporting TO medicore_dbms_demo_login;
REVOKE medicore_dbms_operator FROM medicore_dbms_demo_login;   -- keeps reruns at the documented starting point

-- -----------------------------------------------------------------------------
-- 4. Inspect roles and privileges.
-- -----------------------------------------------------------------------------
\du medicore_dbms*
\dp "appointments"
\dp "vw_dbms*"

-- Privilege matrix computed from the catalog (has_*_privilege checks the
-- effective privilege, including role membership).
WITH roles(role_name) AS (VALUES ('medicore_dbms_admin'), ('medicore_dbms_reporting'),
                                 ('medicore_dbms_operator'), ('medicore_dbms_demo_login')),
objects(object_name, kind) AS (VALUES
  ('appointments', 't'), ('patients', 't'), ('queries', 't'), ('appointment_status_audit', 't'),
  ('vw_dbms_appointment_details', 't'), ('vw_dbms_doctor_appointment_stats', 't'),
  ('vw_dbms_public_doctor_directory', 't'))
SELECT o.object_name,
       r.role_name,
       concat_ws(',',
         CASE WHEN has_table_privilege(r.role_name, format('%I', o.object_name), 'SELECT') THEN 'SELECT' END,
         CASE WHEN has_table_privilege(r.role_name, format('%I', o.object_name), 'INSERT') THEN 'INSERT' END,
         CASE WHEN has_table_privilege(r.role_name, format('%I', o.object_name), 'UPDATE') THEN 'UPDATE' END,
         CASE WHEN has_table_privilege(r.role_name, format('%I', o.object_name), 'DELETE') THEN 'DELETE' END
       ) AS privileges
FROM objects o CROSS JOIN roles r
ORDER BY o.object_name, r.role_name;

SELECT p.proname AS routine, r.role_name,
       has_function_privilege(r.role_name, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
CROSS JOIN (VALUES ('medicore_dbms_admin'), ('medicore_dbms_reporting'),
                   ('medicore_dbms_operator'), ('medicore_dbms_demo_login'), ('public')) AS r(role_name)
WHERE p.pronamespace = 'public'::regnamespace AND p.proname ~ '^(sp|fn)_'
  AND r.role_name <> 'public'
ORDER BY routine, r.role_name;

-- -----------------------------------------------------------------------------
-- 5. Least-privilege proof for the reporting user (SET ROLE = act as that
--    role; privilege checks are the role's own. See 10b for a real login).
-- -----------------------------------------------------------------------------
SET ROLE medicore_dbms_demo_login;
SELECT current_user, session_user;

-- Allowed: views.
SELECT last_name, department_name FROM "vw_dbms_public_doctor_directory" ORDER BY last_name;
SELECT doctor_name, total_appointments FROM "vw_dbms_doctor_appointment_stats" ORDER BY doctor_name;

\set ON_ERROR_STOP off
-- Denied: protected base table (patient contact data).
SELECT "firstName", "phone" FROM "patients";
-- Denied: writing through the base table.
UPDATE "appointments" SET "notes" = 'x' WHERE "id" = '00000000-0000-4000-a000-000000000510';
-- Denied: workflow procedure (reporting is not an operator yet).
CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000510', 'CANCELLED_BY_ADMIN');
\set ON_ERROR_STOP on
RESET ROLE;

-- -----------------------------------------------------------------------------
-- 6. GRANT then REVOKE — before/after for the same statement.
-- -----------------------------------------------------------------------------
-- 6a. GRANT the operator role to the demo login.
GRANT medicore_dbms_operator TO medicore_dbms_demo_login;

BEGIN;
SET LOCAL ROLE medicore_dbms_demo_login;
-- Now allowed: cancel through the procedure (SECURITY DEFINER does the UPDATE).
CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000510', 'CANCELLED_BY_ADMIN',
                           'Security demo', TIMESTAMPTZ '2026-10-10 09:00+00');
SELECT appointment_id, status, cancellation_reason
FROM "vw_dbms_appointment_details"
WHERE appointment_id = '00000000-0000-4000-a000-000000000510';
-- Still denied even as operator: direct UPDATE of the base table.
SAVEPOINT before_direct_update;
\set ON_ERROR_STOP off
UPDATE "appointments" SET "status" = 'BOOKED' WHERE "id" = '00000000-0000-4000-a000-000000000510';
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT before_direct_update;
ROLLBACK;   -- undo the demo cancellation

-- 6b. REVOKE the operator role again: the same CALL is denied.
REVOKE medicore_dbms_operator FROM medicore_dbms_demo_login;
SET ROLE medicore_dbms_demo_login;
\set ON_ERROR_STOP off
CALL sp_cancel_appointment('00000000-0000-4000-a000-000000000510', 'CANCELLED_BY_ADMIN',
                           'Security demo', TIMESTAMPTZ '2026-10-10 09:00+00');
\set ON_ERROR_STOP on
RESET ROLE;

-- 6c. Object-level REVOKE/GRANT: remove SELECT on the directory view from
--     reporting, show the denial, then restore it.
REVOKE SELECT ON "vw_dbms_public_doctor_directory" FROM medicore_dbms_reporting;
SET ROLE medicore_dbms_demo_login;
\set ON_ERROR_STOP off
SELECT COUNT(*) FROM "vw_dbms_public_doctor_directory";
\set ON_ERROR_STOP on
RESET ROLE;
GRANT SELECT ON "vw_dbms_public_doctor_directory" TO medicore_dbms_reporting;
SET ROLE medicore_dbms_demo_login;
SELECT COUNT(*) AS directory_rows_after_regrant FROM "vw_dbms_public_doctor_directory";
RESET ROLE;

-- -----------------------------------------------------------------------------
-- 7. Admin role: DML allowed, DDL and audit tampering denied.
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE medicore_dbms_admin;
UPDATE "departments" SET "description" = "description" WHERE "name" = 'Oncology';
SAVEPOINT s;
\set ON_ERROR_STOP off
CREATE TABLE "admin_should_not_create" (id INT);
ROLLBACK TO SAVEPOINT s;
DELETE FROM "appointment_status_audit";
ROLLBACK TO SAVEPOINT s;
\set ON_ERROR_STOP on
ROLLBACK;

-- Final state: demo data unchanged; starting grants restored.
SELECT (SELECT "status" FROM "appointments" WHERE "id" = '00000000-0000-4000-a000-000000000510') AS appt_510,
       (SELECT COUNT(*) FROM "appointment_status_audit") AS audit_rows,
       pg_has_role('medicore_dbms_demo_login', 'medicore_dbms_operator', 'MEMBER') AS demo_login_is_operator;
