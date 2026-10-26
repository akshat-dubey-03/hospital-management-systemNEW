# Live demonstration script (10–12 minutes)

Follows the review's suggested flow. Every command below was run while preparing this document. The expected output quoted here comes from the evidence files in `results/`.

## Before the demo (not timed)
```bash
# Docker Desktop running; start (or create) a disposable PostgreSQL 15 container
docker start medicore_dbms_test   # or:
docker run -d --name medicore_dbms_test -e POSTGRES_PASSWORD=<any-local-value> postgres:15
```
- Choose a database name that **does not exist yet**, e.g. `medicore_dbms_demo1`. The runner refuses existing names and anything outside `medicore_dbms_*`, so a demo can never touch `medicore_db`.
- Open two extra terminals for step 6 (concurrency by hand) if you want to type it live.
- Keep `docs/dbms/results/` open as a fallback in case anything misbehaves live.

## 1. Clean build: DDL + DML on an empty database (≈ 2 min)
```bash
docs/dbms/run_dbms_scripts.sh --create medicore_dbms_test medicore_dbms_demo1 \
  docs/dbms/sql/01_ddl.sql docs/dbms/sql/02_dml.sql docs/dbms/sql/02_dml.sql \
  docs/dbms/sql/06_views.sql docs/dbms/sql/07_procedures_functions.sql \
  docs/dbms/sql/08_triggers.sql docs/dbms/sql/10_security.sql
```
- **Show:** every line `PASS`.
- **Open `results/02_dml_run2.txt`:** the second DML run gives identical counts (13/6/6/6/10/15/5/5/3/6). The `ON CONFLICT` upserts make the DML safe to rerun. The DDL is deliberately *not* rerunnable: it is for empty databases only.
- **Talking point:** 11 tables, 5 enums, 11 FKs, 9 CHECK constraints, and the partial unique index (`erd.md`).

## 2. Role-based access (≈ 2 min)
```bash
docs/dbms/run_dbms_scripts.sh --user medicore_dbms_demo_login medicore_dbms_test medicore_dbms_demo1 \
  docs/dbms/sql/10b_security_login_session.sql
```
- **Open `results/10b_security_login_session_run.txt`:**
  - `session_user = medicore_dbms_demo_login`, `is_superuser = f`;
  - the views return rows;
  - `permission denied for table patients`, `users` and `appointment_status_audit`, `… for table feedback` (DELETE), `… for procedure sp_respond_to_query`, and `… for schema public` (CREATE TABLE).
- **Then show the GRANT/REVOKE before/after in `results/10_security_run.txt`, section 6:** after `GRANT medicore_dbms_operator` the CALL works, but a direct UPDATE is still denied; after `REVOKE`, the CALL is denied again.
- **Talking point:** DB roles ≠ Express JWT roles. The app uses one shared connection (`security.md`).

## 3. Transactional workflow with deliberate failure and rollback (≈ 2 min)
```bash
docs/dbms/run_dbms_scripts.sh medicore_dbms_test medicore_dbms_demo1 docs/dbms/sql/11_transactions.sql
```
- **TX-2:** the CHECK violation aborts the transaction ("current transaction is aborted…"). `ROLLBACK TO SAVEPOINT` recovers it; the wanted UPDATE commits and the bad INSERT does not.
- **TX-4:** the first `sp_cancel_appointment` succeeds and the second fails (COMPLETED). `COMMIT` answers **ROLLBACK**, so the first cancel is undone too.

## 4. Trigger firing (≈ 1.5 min)
Inside psql (`docker exec -it medicore_dbms_test psql -U postgres -d medicore_dbms_demo1`):
```sql
BEGIN;
UPDATE appointments SET status = 'CONFIRMED', "updatedAt" = now()
WHERE id = '00000000-0000-4000-a000-000000000510';
UPDATE appointments SET status = 'CONFIRMED', "updatedAt" = now()
WHERE id = '00000000-0000-4000-a000-000000000510';         -- same status again
SELECT "oldStatus", "newStatus", "changedBy" FROM appointment_status_audit;   -- 1 row
UPDATE queries SET "adminResponse" = 'Weekday slots only.'
WHERE id = '00000000-0000-4000-a000-000000000702';
SELECT "adminResponse", "respondedAt" FROM queries
WHERE id = '00000000-0000-4000-a000-000000000702';          -- respondedAt filled
ROLLBACK;
SELECT COUNT(*) FROM appointment_status_audit;                -- 0: audit rolled back too
```

## 5. Optimisation before/after (≈ 2 min)
```bash
docs/dbms/run_dbms_scripts.sh medicore_dbms_test medicore_dbms_demo1 docs/dbms/sql/12_indexing_explain.sql
```
(Generates about 192k synthetic rows in roughly 10–20 s; run it ahead of time if you are short on time.)
- **Before:** `BitmapAnd` of two indexes → Sort, 22 buffers, about 1.1 ms.
- **After:** `Index Scan using appointments_patientId_appointmentDate_startTime_idx`, no Sort, 8 buffers, about 0.1 ms.
- **Be honest:** the full-history query keeps the same plan shape, and the composite index is about 6× larger (`indexing.md`).

## 6. Concurrency scenario (≈ 2 min)
**Scripted:**
```bash
docs/dbms/run_concurrency_demo.sh medicore_dbms_test medicore_dbms_demo1
```
Show Scenario 1 in `results/11_concurrency_run.txt`. The monitor line `Lock | transactionid | {pid of A}` is followed by B's `duplicate key value violates unique constraint "appointments_active_doctor_slot_unique"` at the moment A commits.

**Or by hand, in two psql windows:**
```sql
-- window A
BEGIN;
INSERT INTO appointments (id, "patientId", "doctorId", "appointmentDate", "startTime", "endTime", status, "updatedAt")
VALUES ('00000000-0000-4000-a000-0000000005c1', '00000000-0000-4000-a000-000000000201',
        '00000000-0000-4000-a000-000000000306', DATE '2026-12-04', '10:00', '10:30', 'BOOKED', now());
-- window B (hangs)
INSERT INTO appointments (id, "patientId", "doctorId", "appointmentDate", "startTime", "endTime", status, "updatedAt")
VALUES ('00000000-0000-4000-a000-0000000005c2', '00000000-0000-4000-a000-000000000202',
        '00000000-0000-4000-a000-000000000306', DATE '2026-12-04', '10:00', '10:30', 'BOOKED', now());
-- window A
COMMIT;            -- window B immediately fails with 23505
-- cleanup (either window)
DELETE FROM appointments WHERE id = '00000000-0000-4000-a000-0000000005c1';
```

## 7. Close (≈ 30 s)
```bash
docs/dbms/run_dbms_tests.sh medicore_dbms_test medicore_dbms_tests2
```
This takes about 1 minute. Alternatively, show `results/dbms_tests_run.txt` (23/23 PASS) and the negative control (7 FAIL on an incomplete database), which shows the tests really check something.
