# MediCore DBMS deliverables

Database component of the MediCore HMS project for BCSE302P Database Systems (Reviews 2 and 3). **Start with [FINAL_REPORT.md](./FINAL_REPORT.md).**

Every script here is meant for a **dedicated, disposable PostgreSQL 15 database** named `medicore_dbms_*`. None of them may be run against the application database `medicore_db`, and the runners refuse any other name. The schema objects the app should also have (CHECK constraints, views, routines, triggers + audit table, index) are additionally delivered as **additive Prisma migrations** in `backend/prisma/migrations/`.

## Documents

| File | Contents |
|---|---|
| [FINAL_REPORT.md](./FINAL_REPORT.md) | Consolidated report: Review 1 template sections + all Review 2/3 items, results and limitations |
| [erd.md](./erd.md) | Final ER diagram (Mermaid) with cardinalities and delete rules |
| [schema-overview.md](./schema-overview.md) | Table-by-table attributes, keys, indexes, CHECK constraints |
| [normalization.md](./normalization.md) | Functional dependencies, candidate keys, closure example, BCNF/3NF argument, anomalies |
| [DESIGN_CHANGELOG.md](./DESIGN_CHANGELOG.md) | Every change since Review 1, with reason, files and effect |
| [queries.md](./queries.md) | Index of the 47 categorised queries and 10 complex queries |
| [views.md](./views.md) | 3 views, updatability, security_barrier |
| [procedures-functions.md](./procedures-functions.md) | 2 procedures, 2 functions, error contract, tests |
| [triggers.md](./triggers.md) | 2 triggers and the audit table |
| [cursors.md](./cursors.md) | 2 cursor demonstrations and set-based alternatives |
| [security.md](./security.md) | Roles, privilege matrix, GRANT/REVOKE, restricted login |
| [transactions-concurrency.md](./transactions-concurrency.md) | COMMIT/ROLLBACK/SAVEPOINT, failure, two-session concurrency |
| [indexing.md](./indexing.md) | Index choice and EXPLAIN before/after |
| [test-matrix.md](./test-matrix.md) | 23 database test cases and results |
| [seed-and-test-isolation.md](./seed-and-test-isolation.md) | Repeatable seed and the Jest test-database guard |
| [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) | 10–12 minute live demo |
| [VIVA_PREP.md](./VIVA_PREP.md) | Viva answers tied to this schema |
| [PHASE1_REVIEW_NOTES.md](./PHASE1_REVIEW_NOTES.md) | Phase 1 audit and corrections |
| [evidence/README.md](./evidence/README.md) | Screenshot checklist (screenshots still to be taken) |
| [results/](./results/) | Genuine psql captures of every script (SQL echoed + output) |

## SQL scripts (`sql/`, run in this order)

| # | Script | Purpose |
|---|---|---|
| 01 | `01_ddl.sql` | Tables, enums, keys, indexes, partial unique index, CHECKs (empty DB only; not rerunnable) |
| 02 | `02_dml.sql` | Demo data (re-runnable upserts) + UPDATE/DELETE demo that rolls back |
| 03 | `03_sql_queries.sql` | 47 categorised queries |
| 04 | `04_complex_queries.sql` | CQ-01 … CQ-10 |
| 05 | `05_integrity_constraints.sql` | CHECK constraint demonstration |
| 06 | `06_views.sql` | Views (identical to migration) + demos |
| 07 | `07_procedures_functions.sql` | Procedures/functions (identical to migration) + tests |
| 08 | `08_triggers.sql` | Audit table + triggers (identical to migration) + tests |
| 09 | `09_cursors.sql` | Cursor demos |
| 10 | `10_security.sql`, `10b_security_login_session.sql` | Roles and grants; restricted login session (run 10b as `medicore_dbms_demo_login`) |
| 11 | `11_transactions.sql`, `11_concurrency_*.sql` | Transactions; concurrency session scripts (used by `run_concurrency_demo.sh`) |
| 12 | `12_indexing_explain.sql` | Synthetic load + EXPLAIN before/after (run last: adds ~192k rows) |
| — | `seed_row_counts.sql` | Counts used to verify seed repeatability |

## Runners (Git Bash / Linux / macOS, from the repository root)

```bash
# Disposable PostgreSQL 15 (no published port needed)
docker run -d --name medicore_dbms_test -e POSTGRES_PASSWORD=<any-local-value> postgres:15

# Full build + evidence capture into docs/dbms/results/
docs/dbms/run_dbms_scripts.sh --create medicore_dbms_test medicore_dbms_demo \
  docs/dbms/sql/01_ddl.sql docs/dbms/sql/02_dml.sql docs/dbms/sql/03_sql_queries.sql \
  docs/dbms/sql/04_complex_queries.sql docs/dbms/sql/05_integrity_constraints.sql \
  docs/dbms/sql/06_views.sql docs/dbms/sql/07_procedures_functions.sql \
  docs/dbms/sql/08_triggers.sql docs/dbms/sql/09_cursors.sql docs/dbms/sql/10_security.sql \
  docs/dbms/sql/11_transactions.sql
docs/dbms/run_dbms_scripts.sh --user medicore_dbms_demo_login medicore_dbms_test medicore_dbms_demo \
  docs/dbms/sql/10b_security_login_session.sql
docs/dbms/run_concurrency_demo.sh medicore_dbms_test medicore_dbms_demo
docs/dbms/run_dbms_scripts.sh medicore_dbms_test medicore_dbms_demo docs/dbms/sql/12_indexing_explain.sql

# Test suite on a NEW database (23 cases; T21/T23 need DBMS_APP_TEST_URL, see test-matrix.md)
docs/dbms/run_dbms_tests.sh medicore_dbms_test medicore_dbms_tests1

# Clean up when finished
docker rm -f medicore_dbms_test
```

`run_dbms_scripts.sh` refuses database names outside `medicore_dbms_*`, refuses `--create` on an existing database, and never drops anything. Each script's output goes to `results/<script>_run.txt`.

## Execution status
All scripts, migrations and tests were executed on **PostgreSQL 15.15** (Docker `postgres:15`) on 2026-10-10 to 2026-10-13 — see the individual documents for results and `FINAL_REPORT.md` §19 for what is not done.
