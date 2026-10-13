# Evidence and screenshots

## What exists now (genuine, machine-captured)
`docs/dbms/results/*.txt` are real psql captures. Each file starts with the run time, container, database, role and PostgreSQL version, then shows every SQL statement (`psql -e`) followed by its actual output. Nothing in them was edited by hand, apart from removing terminal colour codes from the Jest capture. They contain no passwords, tokens or connection strings.

## Screenshots still to take (by the team)
The review asks for screenshots that show the SQL and its output. **None have been created yet**, and none should be fabricated. Take them from a real terminal while running the command in the second column. Save each as `docs/dbms/evidence/<id>.png`, and make sure no password or `DATABASE_URL` is visible.

| ID | Requirement | Command (repo root) | What must be visible | Cross-check |
|---|---|---|---|---|
| S01 | Clean DDL | `run_dbms_scripts.sh --create … 01_ddl.sql` then `\dt`, `\dT` | 10 tables + enums created | `results/01_ddl_run.txt` |
| S02 | DML + row counts | `… 02_dml.sql` twice | counts identical | `02_dml_run.txt`, `02_dml_run2.txt` |
| S03 | 47 categorized queries | `… 03_sql_queries.sql` (one screenshot per category) | query + result | `03_sql_queries_run.txt` |
| S04 | 10 complex queries | `… 04_complex_queries.sql` (one per CQ) | query + result | `04_complex_queries_run.txt` |
| S05 | CHECK constraints | `… 05_integrity_constraints.sql` | 9 `PASS … rejected` notices | `05_integrity_constraints_run.txt` |
| S06 | Views | `… 06_views.sql` | view rows, `is_updatable = NO`, barrier leak comparison | `06_views_run.txt` |
| S07 | Procedures/functions | `… 07_procedures_functions.sql` | valid CALL output + PASS notices | `07_procedures_functions_run.txt` |
| S08 | Triggers | `… 08_triggers.sql` | audit rows table, respondedAt table | `08_triggers_run.txt` |
| S09 | Cursors | `… 09_cursors.sql` | FETCH pages, exhaustion (0 rows), NOTICE report | `09_cursors_run.txt` |
| S10 | Roles + GRANT/REVOKE | `… 10_security.sql` | privilege matrix, `permission denied`, before/after | `10_security_run.txt` |
| S11 | Restricted login | `--user medicore_dbms_demo_login … 10b_…sql` | session_user, allowed views, denials | `10b_security_login_session_run.txt` |
| S12 | Transactions | `… 11_transactions.sql` | TX-2 abort/savepoint, TX-4 COMMIT→ROLLBACK | `11_transactions_run.txt` |
| S13 | Concurrency | `run_concurrency_demo.sh …` or two psql windows | B waiting, then 23505 | `11_concurrency_run.txt` |
| S14 | EXPLAIN before/after | `… 12_indexing_explain.sql` | both plans | `12_indexing_explain_run.txt` |
| S15 | Test suite | `run_dbms_tests.sh …` | 19 SQL cases + T20–T23 PASS | `dbms_tests_run.txt` |
| S16 | Seed repeatability | see `seed-and-test-isolation.md` | equal counts twice | `seed_repeatability_run.txt` |

Tip: in Windows Terminal, run `docker exec -it medicore_dbms_test psql -U postgres -d <db>`, then `\i` is unavailable (the files are not inside the container). Paste the statements instead, or screenshot the runner output alongside the matching results file.
