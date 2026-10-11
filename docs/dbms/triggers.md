# Triggers and audit history (Phase 7)

Migration: `backend/prisma/migrations/20261011130000_dbms_triggers_audit/migration.sql`. The same text, plus tests, is in `sql/08_triggers.sql`. Evidence: `results/08_triggers_run.txt` (PostgreSQL 15.15).

## Audit table `appointment_status_audit`

Columns: `id` (BIGSERIAL), `appointmentId` (FK, ON DELETE CASCADE), `oldStatus`, `newStatus`, `changedAt` (transaction time), and `changedBy` (`session_user`). It holds no notes, reasons or patient data.

It is modelled in `schema.prisma` (`AppointmentStatusAudit`, plus the `Appointment.statusAudits` relation), so Prisma Migrate does not treat it as drift. The table DDL in the migration is exactly what `prisma migrate diff` generates for that model. The trigger functions and triggers exist only in SQL; Prisma ignores them. `prisma migrate diff` reports no difference both from migrations and from the live test database.

## Trigger A — `trg_queries_responded_at` (BEFORE INSERT OR UPDATE OF adminResponse, respondedAt ON queries)

| Situation | Result |
|---|---|
| Response blank or whitespace | stored as NULL |
| No response | `respondedAt` NULL |
| INSERT with response, no `respondedAt` | `respondedAt = now()` |
| INSERT with response and explicit `respondedAt` | kept (seed/demo data stays deterministic) |
| UPDATE that sets or changes the response | `respondedAt = now()` |
| UPDATE that re-saves the same response | `respondedAt` unchanged |
| UPDATE that clears the response | `respondedAt` NULL |
| UPDATE of other columns only (e.g. status) | trigger does not fire |

It never changes `status` or `updatedAt`. Status transitions belong to the caller (API or `sp_respond_to_query`), and `updatedAt` stays application-managed. Because it only modifies `NEW`, it cannot recurse.

## Trigger B — `trg_appointments_status_audit` (AFTER UPDATE OF status ON appointments, WHEN OLD.status IS DISTINCT FROM NEW.status)

Writes one audit row per *real* status change. That includes changes made through the API, through direct SQL, and through `sp_cancel_appointment`.

- **Not fired on INSERT.** The booking path is untouched; the initial status is already on the appointment row.
- **Same transaction.** The audit row is written in the status change's transaction, so a ROLLBACK, or a failed statement, removes both.
- **SECURITY DEFINER** (pinned `search_path`, EXECUTE revoked from PUBLIC). The audit row can be written even if the role changing the status has no INSERT right on the audit table, so the table can be read-only for everyone else.
- **Limitation:** `changedBy` is the *database* login role. The app uses one shared connection, so in the application this is always the app role, not the doctor or admin logged in to Express. Recording the human user would need the app to pass its user id (e.g. `SET LOCAL app.user_id`), which is out of scope.

## Test results (2026-10-11)

| ID | Case | Result |
|---|---|---|
| T-A1 | insert with response → respondedAt = now() | PASS |
| T-A2 | insert with blank response + respondedAt → both NULL | PASS |
| T-A3 | insert without response → respondedAt NULL | PASS |
| T-A4 | response set on OPEN query → now() | PASS |
| T-A5 | response edited → respondedAt moved from 2026-09-12 to now() | PASS |
| T-A6 | same response re-saved → respondedAt kept (2026-09-20) | PASS |
| T-A7 | response cleared → respondedAt NULL | PASS |
| T-A8 | status-only update → trigger not fired | PASS |
| T-B1 | BOOKED→CONFIRMED → 1 audit row (`changedBy = postgres`) | PASS |
| T-B2 | same status re-written → no row | PASS |
| T-B3 | notes-only update → no row | PASS |
| T-B4 | 2-row update → 2 rows | PASS |
| T-B5 | change via `sp_cancel_appointment` → audited | PASS |
| T-B6 | ROLLBACK → audit row gone (1 inside, 0 after) | PASS |
| T-B7 | status change failing a CHECK → no audit row | PASS |
| — | `02_dml.sql` re-run with triggers installed → 0 audit rows | PASS |
| — | `prisma/seed.js` run twice with triggers installed → 0 audit rows | PASS |
| — | Jest suites with triggers installed → 23/23; fixture cleanup cascades audit rows | PASS |
