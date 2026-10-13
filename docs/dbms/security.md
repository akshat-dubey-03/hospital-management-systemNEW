# SQL security: roles, GRANT/REVOKE, least privilege (Phase 9)

Scripts: `sql/10_security.sql` (setup and demonstrations, run as superuser) and `sql/10b_security_login_session.sql` (run as the restricted login itself). Evidence: `results/10_security_run.txt` and `results/10b_security_login_session_run.txt` (PostgreSQL 15.15).

**Scope.** These scripts were run only in the disposable DBMS database (`medicore_dbms_*` in the `medicore_dbms_test` container). They are not migrations. The application's `medicore_db`, its `DATABASE_URL` and the `medicore_user` role were not touched or referenced.

## Roles

| Role | Login | Purpose |
|---|---|---|
| `medicore_dbms_admin` | no | data administrator: DML on base tables, audit read-only, no DDL |
| `medicore_dbms_reporting` | no | read-only reporting through the `vw_dbms_*` views only |
| `medicore_dbms_operator` | no | workflow operator: changes data only through the stored procedures |
| `medicore_dbms_demo_login` | **yes** | restricted account for the demonstration; member of `reporting` |

None is SUPERUSER, CREATEDB, CREATEROLE or BYPASSRLS. Role creation is idempotent: a `DO` block checks `pg_roles`, because PostgreSQL has no `CREATE ROLE IF NOT EXISTS`.

**No password is set or stored anywhere.** The demonstration logs in through the container's local socket, which uses trust authentication in the official image. For a TCP login, set a password interactively in psql with `\password medicore_dbms_demo_login`.

`PUBLIC` is locked down in the DBMS database. PostgreSQL 15 grants `USAGE` on schema `public` and `EXECUTE` on routines to PUBLIC by default; both are revoked, and `USAGE` is granted only to the three group roles. `GRANT ALL` is never used.

## Privilege matrix (as computed by `has_table_privilege` / `has_function_privilege` in the evidence)

| Object | admin | reporting | operator | demo_login (via reporting) |
|---|---|---|---|---|
| base tables (users, patients, appointments, queries, …) | SELECT, INSERT, UPDATE, DELETE | — | — | — |
| `appointment_status_audit` | SELECT | — | — | — |
| `vw_dbms_appointment_details` | SELECT | SELECT | SELECT | SELECT |
| `vw_dbms_doctor_appointment_stats` | SELECT | SELECT | — | SELECT |
| `vw_dbms_public_doctor_directory` | SELECT | SELECT | — | SELECT |
| `sp_cancel_appointment`, `sp_respond_to_query` | EXECUTE | — | EXECUTE | — (until GRANT operator) |
| `fn_doctor_completed_count`, `fn_patient_upcoming_count` | EXECUTE | — | — | — |
| schema `public` | USAGE (no CREATE) | USAGE | USAGE | USAGE |

**How restricted access works.**
- **Views:** a view runs with its owner's rights, so the reporting role reads data through the views without holding any base-table privilege.
- **Procedures:** the procedures are `SECURITY DEFINER`. The operator can cancel appointments or respond to queries only through them, with their validation, and never with a direct `UPDATE`.
- **Functions:** these are `SECURITY INVOKER` and read base tables, so they are deliberately not granted to reporting. Granting `EXECUTE` alone would only produce a permission error on `appointments`.

## Demonstrated results

| Step | Who | Statement | Result |
|---|---|---|---|
| 5 | demo_login (SET ROLE) | SELECT directory / stats views | allowed |
| 5 | demo_login | `SELECT … FROM patients` | `permission denied for table patients` |
| 5 | demo_login | `UPDATE appointments` | `permission denied for table appointments` |
| 5 | demo_login | `CALL sp_cancel_appointment` | `permission denied for procedure sp_cancel_appointment` |
| 6a | after `GRANT medicore_dbms_operator TO demo_login` | `CALL sp_cancel_appointment` | allowed: appointment 510 → CANCELLED_BY_ADMIN (then rolled back) |
| 6a | same | direct `UPDATE appointments` | still `permission denied` |
| 6b | after `REVOKE medicore_dbms_operator FROM demo_login` | same CALL | `permission denied for procedure` |
| 6c | after `REVOKE SELECT ON vw_dbms_public_doctor_directory FROM reporting` | SELECT view | `permission denied for view` → re-GRANT → 5 rows |
| 7 | admin | UPDATE departments | allowed |
| 7 | admin | `CREATE TABLE` | `permission denied for schema public` |
| 7 | admin | `DELETE FROM appointment_status_audit` | `permission denied for table appointment_status_audit` |
| 10b | **real login** `medicore_dbms_demo_login` (session_user = current_user, not superuser) | views | allowed (5 appointments, 5 doctors) |
| 10b | real login | patients / users / audit / DELETE feedback / CALL sp_respond_to_query / CREATE TABLE | all `permission denied` |

Final state check: appointment 510 is back to BOOKED, there are 0 audit rows, and demo_login is not an operator (the starting grants are restored).

## Database roles vs application authorization

These roles are **separate from** the Express JWT + `roleGuard` authorization. The application connects with one shared database user, so PostgreSQL cannot tell which patient, doctor or admin is logged in. The per-patient and per-doctor row scoping in the API is enforced by application code (scoped Prisma queries), not by these roles.

The roles demonstrate least privilege for direct database access: reporting tools, operators and administrators. Enforcing per-user rows in the database would need row-level security policies plus a per-request identity, for example `SET LOCAL app.user_id`. That is not implemented.
