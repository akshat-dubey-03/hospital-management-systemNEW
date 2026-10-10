# Phase 1 review notes

The original `PHASE1_REVIEW_NOTES.md` from the static-reviewed bundle was not included in the handoff package. This file rebuilds that log from the handoff document and records the audit and execution carried out on 2026-10-10.

## 1. Static review corrections (prior chat, carried over)

These were already present in the SQL files received:

- Demo support query and feedback rows were added so CQ-04 returns a meaningful row.
- An active doctor with availability but no upcoming appointment was added for CQ-05.
- A second active same-day appointment was added so LAG/LEAD in CQ-09 links two rows.
- CQ-06 was rewritten to aggregate chat statistics and appointment counts separately. This avoids inflated message/token totals caused by join fan-out.
- CQ-04's last-doctor lookup is restricted to COMPLETED appointments, with a deterministic tie-breaker.
- CQ-09 has a date filter.
- Comments now state that consultation-fee totals are estimates, not billed revenue (there is no invoice table).
- The UNION / UNION ALL explanation was corrected.
- The blanket 3NF claim was softened.

## 2. Audit corrections (2026-10-10)

| # | File / ID | Problem | Correction |
|---|-----------|---------|------------|
| 1 | Repository | Files were only in the git-ignored `dbms_handoff_package/` and never pushed | Moved to `docs/dbms/` on branch `dbms/review-2-3` |
| 2 | `02_dml.sql` A.6 | 10 of 15 appointments fell on a weekday or time outside the doctor's `doctor_availability` (0=Monday convention, `backend/src/utils/dateTime.js`) | Moved appointments 501, 504, 505, 506, 507, 508, 512, 513, 514 to a valid weekday/time in the same month. Moved the cancellation timestamps for 505/506 so they fall before the visit. Verified by query: 0 appointments outside availability |
| 3 | `03` BQ-C05 | Self-join on shared blood group returned 0 rows (all demo blood groups were distinct) | Patient Nair's blood group changed from O- to O+. The query now returns Kumar–Nair |
| 4 | `02_dml.sql` A.4 | Patient and doctor were both named "Meera Iyer" | Doctor 306 renamed to Dr Kavita Rao (`demo.dr.rao@…`) |
| 5 | `03` BQ-C03, BQ-A01 | Garbled or misleading comments | Rewritten |
| 6 | `03` BQ-B03/B04/D01/F07, `04` CQ-03/CQ-10 | Averages printed with 16 decimal places | Wrapped in `ROUND(…, 2)` (display only, no change to logic) |

## 3. Execution verification

Environment: PostgreSQL 15.15 (Debian) in a disposable Docker container `medicore_dbms_test` (image `postgres:15`), database `medicore_dbms_test`. No published port and no named volume. The application database `medicore_db` was not touched. Flags: `psql -v ON_ERROR_STOP=1 -X -e`.

| Step | Result | Evidence |
|------|--------|----------|
| `01_ddl.sql` on an empty DB | Exit 0, no errors. 10 tables, 5 enums, 10 FKs, 24 indexes (10 PK + 5 unique + 8 non-unique + 1 partial). Partial index predicate excludes the three cancelled statuses | `results/01_ddl_run.txt` |
| `02_dml.sql` run 1 | Exit 0. users 13, departments 6, patients 6, doctors 6, availability 10, appointments 15, feedback 5, queries 5, conversations 3, messages 6 | `results/02_dml_run1.txt` |
| `02_dml.sql` run 2 (idempotency) | Exit 0, identical row counts | `results/02_dml_run2.txt` |
| Section B transaction | Inside the transaction: UPDATE 1 ×3, DELETE 1, changes visible. After ROLLBACK: feedback 601 isRead = false, appointment 510 = BOOKED, query 702 = OPEN, feedback 699 still present | `results/02_dml_run*.txt` |
| `03_sql_queries.sql` | Exit 0, 47 result sets, none empty | `results/03_sql_queries_run.txt` |
| `04_complex_queries.sql` | Exit 0, 10 result sets, none empty. CQ-04 → Kumar. CQ-05 → Dr Rao only. CQ-09 → 2 rows linked by LAG/LEAD | `results/04_complex_queries_run.txt` |
| Constraint checks (rolled back) | Rebooking cancelled slot succeeds. A duplicate active slot fails on `appointments_active_doctor_slot_unique`. Deleting a patient or doctor user with appointments fails (RESTRICT). Appointment count unchanged after rollback | `results/05_constraint_checks_run.txt` |

## 4. Known limitations and open items

- `01_ddl.sql` is designed for an empty database and is not rerunnable. This is intentional: there are no DROP statements.
- Feedback row 699 is a dedicated DML-demo row that survives the rollback by design. It is counted in the feedback aggregates (for example, BQ-B03 counts 5 rows with a minimum rating of 1).
- `02_dml.sql` only demonstrates BEGIN/ROLLBACK. COMMIT and SAVEPOINT demonstrations (a Review 2 requirement) belong in the later transactions phase.
- Not yet implemented (later phases): views, procedures, functions, triggers, cursors, roles/GRANT/REVOKE, an EXPLAIN/index comparison, the test matrix, the design-change log and screenshots.
- `results/*.txt` are text captures of real runs. Screenshots for the report still need to be taken.
