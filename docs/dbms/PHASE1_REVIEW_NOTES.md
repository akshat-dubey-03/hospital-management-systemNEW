# Phase 1 SQL review notes

This copy of the Phase 1 deliverables was statically reviewed against the uploaded MediCore repository ZIP. It has **not** been executed against PostgreSQL.

## Corrections applied to this reviewed copy

- Added a demo patient support query for a patient who also has unread feedback, so CQ-04 can demonstrate a non-empty intersection.
- Added an active doctor with an availability block and no upcoming appointment, so CQ-05 has meaningful data.
- Added a second non-cancelled appointment for the same doctor on 2026-10-15, so CQ-09 demonstrates LAG/LEAD across two rows.
- Rewrote CQ-06 to aggregate chat statistics and appointment counts separately before joining to patients, preventing message/token totals from being multiplied by appointment joins.
- Restricted CQ-04's “last doctor they saw” lookup to completed appointments and added a deterministic tie-breaker.
- Added a selected-date predicate to CQ-09 to match its business question.
- Clarified that fee totals are estimated consultation-fee potential, not actual billing/revenue (the current schema has no invoice table).
- Corrected the UNION/UNION ALL wording: these queries return patient/source pairs, not globally unique patient IDs across the two sources.
- Updated the normalization note to avoid claiming 3NF without a separate formal proof.

## Still required before submission

1. Execute `01_ddl.sql` on a **dedicated empty disposable PostgreSQL database**.
2. Execute `02_dml.sql`, then check row counts and re-run it to verify repeatability.
3. Execute all queries in `03_sql_queries.sql` and `04_complex_queries.sql`; correct any PostgreSQL errors and retain genuine output evidence.
4. Record runtime results. Nothing in this note should be treated as proof of PostgreSQL execution.
5. Later phases still need views, procedures, functions, triggers, cursors, role/privilege demonstrations, transaction/concurrency evidence, index/EXPLAIN comparison, and the complete report.
