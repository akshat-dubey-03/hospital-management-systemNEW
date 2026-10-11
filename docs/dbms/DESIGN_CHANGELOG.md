# Design change log (since Review 1)

Each entry lists the change, why it was made, where it lives, and its effect. The base migration `20260830194500_appointment_workflow_foundation` has never been edited; every schema change is a new, additive migration.

| # | Date | Change | Reason | Files | Effect on app |
|---|------|--------|--------|-------|---------------|
| 1 | 2026-10-10 | Standalone DBMS SQL pack (DDL, demo DML, 47 categorised + 10 complex queries) moved into `docs/dbms/` and executed on PostgreSQL 15.15 | Review 2 deliverables; Phase 1 files had never been run | `docs/dbms/sql/01–04`, `docs/dbms/results/` | None |
| 2 | 2026-10-10 | Demo appointments moved onto valid availability days; demo data/name/comment fixes | Data realism; BQ-C05 returned no rows | `docs/dbms/sql/02_dml.sql`, `03_sql_queries.sql` | None |
| 3 | 2026-10-11 | 9 CHECK constraints (rating 1–5, dayOfWeek 0–6, HH:MM format and end > start for availability and appointments, positive slot length, non-negative experience/fee) | Rules existed only in Zod/comments, or nowhere; protect data from every writer | `backend/prisma/migrations/20261011100000_dbms_integrity_checks/`, `01_ddl.sql`, `05_integrity_constraints.sql` | None: existing data and all 23 Jest tests pass |
| 4 | 2026-10-11 | Added `prisma/migrations/migration_lock.toml` (`provider = "postgresql"`) | Standard Prisma file that was missing; without it `prisma migrate diff --from-migrations` cannot run | `backend/prisma/migrations/migration_lock.toml` | None |
| 5 | 2026-10-11 | Seed made idempotent (upserts, fixed demo UUIDs), deterministic (anchor date, availability-aligned weekdays) and atomic (single transaction); `prisma db seed` registered | Re-running the seed duplicated appointments/feedback/queries/chat; dates drifted | `backend/prisma/seed.js`, `backend/package.json` | Same demo accounts and data shape; reruns no longer duplicate |
| 6 | 2026-10-11 | Jest guard requiring a dedicated `TEST_DATABASE_URL` | Integration tests delete fixture rows and previously used the everyday `DATABASE_URL` | `backend/test/setupTestDatabase.js`, `backend/package.json`, `env.example` | Tests must now be given a test DB; 23/23 pass |
