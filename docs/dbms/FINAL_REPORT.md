# MediCore HMS — DBMS Project Report (Reviews 2 and 3)

**Course:** BCSE302P Database Systems Lab · **Submitted to:** Dr. Anand Bihari, School of Computer Science and Engineering
**Team:** _<Member 1 name (Reg. no.)>_ · _<Member 2 name (Reg. no.)>_ · _<Member 3 name (Reg. no.)>_ ← to be filled in by the team
**DBMS:** PostgreSQL 15 (all evidence: 15.15) · **ORM:** Prisma 5 · **Repository:** github.com/akshat-dubey-03/hospital-management-systemNEW

> **How to read this report.** Sections 1–8 follow the Review 1 template. Sections 9–18 cover the Review 2/3 items listed in the project handoff; the Review 2/3 template documents themselves were not available. Every result quoted below comes from a file in `docs/dbms/results/`, which holds real psql captures. Section 19 lists what is **not** done.

---

## Abstract
MediCore is a web hospital-management system (React/Vite, Node/Express, PostgreSQL, Prisma). Patients book appointments with doctors, doctors manage their schedules, and administrators oversee operations.

This report covers the database component:
- an 11-table relational schema in BCNF, with domain enums, foreign keys with deliberate delete rules, 9 CHECK constraints, and a partial unique index that prevents double-booking while allowing cancelled slots to be rebooked;
- 47 categorised queries and 10 complex business queries;
- 3 views, 2 stored procedures, 2 functions, 2 triggers with an audit table, 2 cursor demonstrations;
- role-based least privilege, transaction and concurrency demonstrations, and an evidence-based index optimisation;
- a 23-case database test suite.

All of it was executed on PostgreSQL 15.15 in disposable Docker databases, never on the application database.

## 1. Introduction
Hospitals lose time and patient trust to double-booked slots, untracked cancellations and unanswered patient queries. MediCore centralises doctor availability and appointment booking, and records feedback, support queries and AI-assistant conversations. The database enforces the rules that must never break, for example one active booking per doctor slot, regardless of which client writes the data.

## 2. Project scope
**Implemented in the database:**
- user accounts with roles (patient / doctor / admin) and 1:1 profiles;
- departments;
- weekly doctor availability; bookable slots are derived from it, not stored;
- the appointment lifecycle: booked → confirmed → completed, or cancelled by patient, doctor or admin;
- appointment status audit history;
- patient feedback (1–5 rating), support queries with admin responses, and AI chat conversations and messages.

**Out of scope (no tables exist):** billing/invoices, clinical records, diagnoses, lab results, pharmacy. Fee figures in reports are labelled *estimates* (completed visits × current consultation fee).

## 3. Key contacts and stakeholders
| Name | Registration number | Phone / email |
|---|---|---|
| _to be filled in_ | | |

Stakeholders: patients (booking, history, feedback), doctors (schedule, status updates), administrators (operations, queries), and the database administrator (integrity, access, backups).

## 4. Project resource requirements
PostgreSQL 15 (Docker image `postgres:15`), Prisma 5.22, Node.js 22, Express 4, React 18 + Vite 5, Jest 29, Docker Desktop, Git/GitHub, psql. Diagrams use Mermaid.

## 5. ER diagram
See **`erd.md`** (Mermaid source, renders on GitHub). There are 11 entities. Review 1 had 10; `appointment_status_audit` was added in Review 3. The file also has the full cardinality and delete-rule table.

## 6. Tables and constraints
- **Detailed attribute tables:** see `schema-overview.md` and the Review 1 report, Section 6.
- **Executable DDL:** `sql/01_ddl.sql` (evidence: `results/01_ddl_run.txt`).
- **Summary of what enforces integrity in the database:**
  - primary keys (UUID; BIGSERIAL for the audit table);
  - unique keys: `users.email`, `departments.name`, `patients.userId`, `doctors.userId`, `doctor_availability(doctorId, dayOfWeek, startTime)`;
  - 11 foreign keys: CASCADE for owned data, RESTRICT for medical history;
  - 5 enums;
  - 9 CHECK constraints added after Review 1 (Section 9);
  - the partial unique index `appointments_active_doctor_slot_unique`.

**Normal forms:** every table is in **BCNF**, which implies 3NF. The argument uses explicit FDs, candidate keys and an attribute-closure example; it also explains why `(doctorId, date, startTime)` is *not* a key and why `endTime` is stored. See **`normalization.md`**.

## 7. Work breakdown
| Member | Work assigned |
|---|---|
| _to be filled in_ | _e.g. database design, SQL pack, Review 3 objects, application_ |

## 8. Design change log since Review 1
**`DESIGN_CHANGELOG.md`** has one row per change, with the reason, files and effect. In summary:
1. SQL pack executed and corrected; demo data aligned to availability.
2. 9 CHECK constraints.
3. `migration_lock.toml` added.
4. Idempotent, atomic seed.
5. Test-database guard for Jest.
6. 3 views.
7. 2 procedures and 2 functions.
8. Audit table and 2 triggers.
9. Cursor demonstrations.
10. Roles and grants (demo database only).
11. Transaction and concurrency demonstrations.
12. Composite patient index replacing the single-column one.
13. Test suite.

The original migration was never edited; four additive migrations follow it.

---

## 9. DDL / DML execution (Review 2)
| Script | Result | Evidence |
|---|---|---|
| `01_ddl.sql` on an empty database | PASS: 10 base tables, 5 enums, FKs, indexes, partial unique index, 9 CHECKs | `results/01_ddl_run.txt` |
| `02_dml.sql` (INSERT, plus UPDATE/DELETE inside a rolled-back transaction) | PASS: users 13, departments 6, patients 6, doctors 6, availability 10, appointments 15, feedback 5, queries 5, conversations 3, messages 6 | `results/02_dml_run.txt` |
| `02_dml.sql` again on the same database | PASS: identical counts (upserts) | `results/02_dml_run2.txt` |
| `05_integrity_constraints.sql` | PASS: 9 bad writes rejected by the named constraint; NULL and boundary values accepted | `results/05_integrity_constraints_run.txt` |

## 10. Queries (Review 2/3)
`sql/03_sql_queries.sql` has **47 categorised queries**; every one executed (`results/03_sql_queries_run.txt`), and the index is in `queries.md`:

| Category | Count |
|---|---|
| Basic | 8 |
| Aggregate | 7 |
| Joins | 7 |
| Subqueries | 9 |
| Set operations | 4 |
| Advanced functions | 8 |
| Window functions | 4 |

**Complex business queries** (`sql/04_complex_queries.sql`; full SQL and expected structure are in the file; actual output in `results/04_complex_queries_run.txt`):

| ID | Business question | Construct | Actual result (demo data) |
|---|---|---|---|
| CQ-01 | Completed, pipeline and cancelled load per department | 3-table join, `FILTER` aggregates | 5 departments. Cardiology 2/3/1 (33.3 % complete); Dermatology has 2 doctors and no appointments |
| CQ-02 | Each patient's last completed visit and next booked visit | correlated subqueries, 5 tables | 6 patients, e.g. Kumar: last 2026-09-03 with Sharma, next 2026-10-15 10:00 |
| CQ-03 | Estimated completed-visit fees by department and month | 3-table join, `GROUP BY` month | 4 rows: 2026-08 Cardiology/Neurology/Orthopedics, 2026-09 Cardiology (800.00) |
| CQ-04 | Patients with unread feedback **and** an active query, plus their last doctor | `INTERSECT`, correlated `STRING_AGG` | Kumar (1 unread; "Cardiology follow-up question"; Sharma, Cardiology) |
| CQ-05 | Active doctors with availability but nothing upcoming | `NOT EXISTS` anti-join | Dr Kavita Rao, Dermatology, 1 block |
| CQ-06 | Chat engagement vs appointments per patient | CTEs aggregated separately (no fan-out) | Kumar 4 messages / 108 tokens / 4 appointments; Patel 2 / 38 / 4 |
| CQ-07 | Patients seen in 2+ departments | 4-table join, `HAVING COUNT(DISTINCT)` | Kumar and Nair (Cardiology + Orthopedics), Patel (Cardiology + Neurology) |
| CQ-08 | Cancellations by actor and department | `FILTER`, share % | Neurology 33.3 % (patient), Pediatrics 33.3 % (admin), Cardiology 16.7 % (doctor) |
| CQ-09 | Same-day schedule with previous and next patient | `LAG` / `LEAD` window | 2026-10-15 Sharma: Kumar 10:00 → Patel 10:30 |
| CQ-10 | Completed visits by doctors above the average fee | scalar subquery + `LAG` | 3 visits (Sharma 800, Mehta 750 vs average 706.00) |

## 11. Views (Review 3)
`views.md`, `sql/06_views.sql`, migration `20261011110000_dbms_views`.

| View | Purpose | Updatable? |
|---|---|---|
| `vw_dbms_appointment_details` | 4-table join; omits clinical notes and patient contact data | No (join) |
| `vw_dbms_doctor_appointment_stats` | per-doctor status counts, completion %, fee estimate | No (aggregate) |
| `vw_dbms_public_doctor_directory` | `security_barrier`; active doctors and public columns only | No (join) |

**Verified:**
- the detail view equals its 4-table base join, with 0 mismatched rows;
- the statistics view matches a direct `GROUP BY`;
- the inactive doctor is hidden from the directory;
- a live comparison shows a caller's function seeing the hidden row through an identical *plain* view, but not through the barrier view.

## 12. Stored procedures and functions (Review 3)
`procedures-functions.md`, `sql/07_procedures_functions.sql`, migration `20261011120000_dbms_routines`.

**Procedures:**
- `sp_cancel_appointment(id, cancel_status, reason, as_of)`
- `sp_respond_to_query(id, status, response)`

Both are `SECURITY DEFINER` with a pinned `search_path`, lock the row with `FOR UPDATE`, apply the API's transition rules, set `updatedAt` explicitly, and have EXECUTE revoked from PUBLIC.

**Functions:**
- `fn_doctor_completed_count(doctor)`
- `fn_patient_upcoming_count(patient, as_of)`

Both are `STABLE`, return NULL for unknown ids, and can be used in `SELECT`/`WHERE`.

**Tested:** 20 cases, all PASS — valid calls, every documented SQLSTATE (22004, 22023, P0002, 55000), a repeated call, rebooking a cancelled slot, and rollback. The application does not call these routines.

## 13. Triggers and audit (Review 3)
`triggers.md`, `sql/08_triggers.sql`, migration `20261011130000_dbms_triggers_audit`.

- **`trg_queries_responded_at`** (BEFORE INSERT / UPDATE OF adminResponse, respondedAt): a blank response becomes NULL; a new or changed response sets `respondedAt = now()`; clearing the response clears it.
- **`trg_appointments_status_audit`** (AFTER UPDATE OF status, `WHEN OLD.status IS DISTINCT FROM NEW.status`, SECURITY DEFINER): one audit row per *real* change. The audit row rolls back with the change.

**Tested:** 15 cases, all PASS. Re-running the seed or DML adds no audit rows. **Limitation:** `changedBy` is the database role, not the Express user.

## 14. Cursors (Review 3)
`cursors.md`, `sql/09_cursors.sql`.

1. A `SCROLL` cursor pages through upcoming appointments: `FETCH 3`, `PRIOR`, `MOVE`, `ALL`, an empty fetch at exhaustion, `ABSOLUTE`, and `pg_cursors`.
2. A parameterised PL/pgSQL cursor builds a per-doctor workload report with department subtotals.

Each is followed by its set-based equivalent (`LIMIT/OFFSET`; `GROUPING SETS`), which produced identical results. Both are read-only.

## 15. SQL security (Review 3)
`security.md`, `sql/10_security.sql`, `sql/10b_security_login_session.sql`.

**Roles:**
- `medicore_dbms_admin`: DML on base tables, audit read-only, no DDL;
- `medicore_dbms_reporting`: views only;
- `medicore_dbms_operator`: procedures plus the detail view;
- login `medicore_dbms_demo_login`: no password stored anywhere.

PUBLIC is revoked, and `GRANT ALL` is never used. The privilege matrix is computed with `has_table_privilege` / `has_function_privilege`.

**Before/after:** granting the operator role lets the demo login CALL the cancel procedure, while a direct UPDATE stays denied; revoking the role denies the CALL again. Object-level `REVOKE SELECT` on a view is also shown.

**Real login session:** `session_user = medicore_dbms_demo_login`, not superuser. The views are readable; `patients`, `users`, the audit table, `DELETE`, `CALL` and `CREATE` all fail with genuine `permission denied` errors.

These roles exist only in the disposable database. The application's database user is unchanged, and per-user row scoping remains in the API (JWT + roleGuard).

## 16. Transactions and concurrency (Review 2/3)
`transactions-concurrency.md`, `sql/11_transactions.sql`, `run_concurrency_demo.sh`.

**Single session:**
- COMMIT;
- SAVEPOINT recovery from a CHECK failure ("current transaction is aborted" until `ROLLBACK TO`);
- a full ROLLBACK that also removes audit rows;
- a failing procedure call that makes `COMMIT` return ROLLBACK;
- a cancelled slot rebooked while an active duplicate is rejected. The *overlap* limitation is shown honestly.

**Two genuinely concurrent sessions:**
- **Duplicate slot:** B blocks on A's uncommitted index entry (`Lock / transactionid`, blocked by A's pid). B fails with 23505 the instant A commits, and succeeds if A rolls back.
- **Concurrent cancel of the same appointment:** serialised by the procedure's row lock; the second caller is refused.

Isolation level tested: read committed.

## 17. Indexing and optimisation (Review 2/3)
`indexing.md`, `sql/12_indexing_explain.sql`, migration `20261011140000_dbms_patient_schedule_index`.

The new index `appointments(patientId, appointmentDate, startTime)` replaces the redundant single-column `patientId` index. Measurements on 192,015 synthetic rows:
- **Bounded upcoming query:** before, `BitmapAnd` + Sort, 22 buffers, 1.10 ms; after, `Index Scan` with no Sort, 8 buffers, 0.10 ms.
- **Full-history query:** the same plan shape; no improvement is claimed.
- **Cost:** the index is 9.3 MB vs 1.5 MB.

Also shown: the leftmost-prefix rule and a legitimate sequential scan.

## 18. Testing
`test-matrix.md`, `tests/dbms_tests.sql`, `run_dbms_tests.sh`.

**23 cases, 23 PASS** (`results/dbms_tests_run.txt`):
- 19 SQL assertion cases;
- a two-session race;
- seed repeatability;
- the Jest test-database guard;
- the application's 23 Jest tests.

A negative control on an incomplete database produced 7 FAIL, which shows the assertions detect missing objects.

## 19. Limitations and items not done
- **Screenshots:** not yet taken. The genuine text captures are in `results/`. `evidence/README.md` lists the 16 screenshots to take and the command for each.
- **Team details:** names, registration numbers and work breakdown (Sections 3 and 7) are placeholders.
- **ER image:** the diagram is Mermaid source; a PNG/SVG export for the printed report still has to be made (e.g. with mermaid.live).
- **Overlapping bookings:** an appointment with a different start time that overlaps another is not blocked (needs a `btree_gist` exclusion constraint); documented, not implemented.
- **Isolation levels:** only read committed was tested; deadlocks were not demonstrated.
- **Audit identity:** records the database role, not the human user.
- **Dashboard query:** the patient dashboard still filters upcoming appointments in JavaScript, so it does not yet benefit from the new index; recommended change not made.
- **Unused routines:** the application does not call the procedures or functions (by design for this academic work).
- **Unfinished app features:** feedback, query and chat API/UI endpoints are still placeholders, so those tables are filled only by seed or SQL.
- **Backups:** no backup or recovery process exists. What would be needed is described in `VIVA_PREP.md`.
- **Templates:** the Review 2/3 templates were not available; the structure follows the handoff checklist.

## Appendix: demo and viva
- `DEMO_SCRIPT.md`: 10–12 minute live demo in the review's order (clean build → roles → failure/rollback → trigger → optimisation → concurrency).
- `VIVA_PREP.md`: schema-specific answers on keys, FDs, normal forms, delete rules, CHECK/NULL, joins and set operations, index order, EXPLAIN, isolation, routines vs triggers vs cursors, injection and least privilege, hashing, and backup.
