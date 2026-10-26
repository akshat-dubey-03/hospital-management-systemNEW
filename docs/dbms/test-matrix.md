# DBMS test matrix (Phase 12)

Run: `docs/dbms/run_dbms_tests.sh <container> <new medicore_dbms_* database>` from the repository root. Optionally export `DBMS_APP_TEST_URL` (a migrated database whose name contains `test`) to include T21 and T23.

The runner:
1. builds a **new** disposable database from 01, 02, 06, 07, 08, 10 and 12, refusing an existing name or any name outside `medicore_dbms_*`;
2. runs the SQL assertion suite `tests/dbms_tests.sql` (T01–T19);
3. runs the multi-session and application cases (T20–T23).

Missing prerequisites are reported **NOT RUN**, never PASS. No connection string is printed.

**Safety.**
- `dbms_tests.sql` refuses to run unless `current_database()` matches `medicore_dbms_*`.
- Each case that writes undoes itself: its PL/pgSQL block is a subtransaction ended by a sentinel exception, SQLSTATE `P0099`.
- Expected errors are caught by their exact SQLSTATE only.
- T19 then checks that the demo data is untouched.

**Latest run:** 2026-10-13, PostgreSQL 15.15, database `medicore_dbms_tests1` → **23 / 23 PASS** (`results/dbms_tests_run.txt`).
**Negative control:** the same SQL suite against `medicore_dbms_p6`, which lacks the triggers, audit table, roles, index migration and synthetic data. It gives **7 FAIL / 12 PASS** with exit code 3 (`results/dbms_tests_negative_control.txt`), which shows the assertions do detect missing objects.

| ID | Area | Precondition | Action | Expected | Result |
|---|---|---|---|---|---|
| T01 | DDL / objects | full build | count catalog objects | 11 tables, 5 enums, 11 FKs, 9 CHECKs, 3 views, 4 routines, 2 triggers, partial unique index with WHERE | PASS |
| T02 | Primary key | demo user …0001 | insert same `users.id` | `unique_violation` naming `users_pkey` | PASS |
| T03 | Foreign key | — | appointment with unknown patient | `foreign_key_violation` | PASS |
| T04 | CHECK + NULL | — | rating 0; availability end < start; ratings NULL / 1 / 5 | first two `check_violation`; last three accepted (then undone) | PASS |
| T05 | ON DELETE | demo data | delete patient with appointments; delete conversation 801 | RESTRICT error; 4 messages cascade-deleted (then undone) | PASS |
| T06 | Partial unique index | 510 active, 506 cancelled | book 510's slot; book 506's slot | 23505 on `appointments_active_doctor_slot_unique`; cancelled slot rebookable | PASS |
| T07 | Query correctness | demo data | status distribution; CQ-04 core; BQ-C05 | 5/1/1/1/4/3; `Kumar`; `Kumar-Nair` | PASS |
| T08 | Views vs base | full build | symmetric `EXCEPT`; per-doctor totals; inactive doctor | 0 mismatches; totals equal; Gupta hidden | PASS |
| T09 | Functions | demo data | `fn_doctor_completed_count`, `fn_patient_upcoming_count` incl. unknown ids | 2, NULL, 2, NULL | PASS |
| T10 | Procedures (valid) | demo data | cancel 510; resolve query 702 | status, trimmed reason, cancelledAt, updatedAt = txn time; RESOLVED + respondedAt (undone) | PASS |
| T11 | Procedures (invalid) | demo data | completed 501, started 508, unknown id, `BOOKED` as cancel status, CLOSED query 704 | 55000, 55000, P0002, 22023, 55000 | PASS |
| T12 | Audit trigger | no audit rows | real change, same status, notes-only on 512 | exactly 1 row BOOKED→CONFIRMED by `session_user` | PASS |
| T13 | respondedAt trigger | demo queries | set, re-save, clear, blank | now(); kept; NULL; NULL/NULL | PASS |
| T14 | Rollback / savepoint | — | outer update + failing inner block | inner write undone, outer kept with 1 audit row; outer undo removes both | PASS |
| T15 | Least privilege (allowed) | 10_security | demo login reads views; operator CALLs cancel | succeeds; role reset afterwards | PASS |
| T16 | Least privilege (denied) | 10_security | demo login: patients, DELETE feedback, CALL procedure; operator: UPDATE appointments | 4 × `insufficient_privilege` | PASS |
| T17 | Indexing | 12 (192k rows) | catalog check + `EXPLAIN` of the bounded upcoming query | composite present, old index gone, `Index Scan` on composite, no `Sort` | PASS |
| T18 | Cursor | demo data | explicit cursor loop vs `string_agg` | identical id sequence (508, 509, 510, 515, 512, 511, 513, 514) | PASS |
| T19 | Isolation of cases | after T01–T18 | demo counts and audit table | 15 appointments, 5 feedback, 5 queries, 0 audit rows, 510 BOOKED | PASS |
| T20 | Concurrency (2 sessions) | demo data | A inserts Rao 2026-12-04 10:00 and holds 3 s; B inserts the same slot | B blocked on a lock (sampled), then 23505; exactly 1 row | PASS |
| T21 | Seed repeatability | `DBMS_APP_TEST_URL` | `seed.js` twice with the same anchor | identical counts, 0 duplicates | PASS |
| T22 | Test DB guard | backend deps | Jest with `TEST_DATABASE_URL` → `medicore_db` | refused before connecting | PASS |
| T23 | App regression | `DBMS_APP_TEST_URL` | Jest suites through the guard | 23 / 23 pass | PASS |

**Not covered (stated limitations).**
- Overlapping-interval bookings are not prevented. TX-5 in `11_transactions.sql` documents this; it is not a failing test.
- Isolation levels above read committed were not tested.
- `changedBy` records the database role, not the Express user.
