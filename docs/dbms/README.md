# MediCore DBMS deliverables

These files support the **Database Management Systems** Review 2 and Review 3 assessments for MediCore. They document and reproduce the **existing** PostgreSQL schema used by the application. They are **not** a replacement for Prisma migrations, and they must **not** be applied to the application’s live development database.

## Purpose

| File | Purpose |
|------|---------|
| [schema-overview.md](./schema-overview.md) | Human-readable description of the ten tables, ENUMs, keys, indexes, and delete rules |
| [sql/01_ddl.sql](./sql/01_ddl.sql) | Standalone DDL that reproduces the current schema |
| [sql/02_dml.sql](./sql/02_dml.sql) | Demonstration INSERT / UPDATE / DELETE against that schema |
| [sql/03_sql_queries.sql](./sql/03_sql_queries.sql) | Categorised SQL query pack (Review 2) |
| [sql/04_complex_queries.sql](./sql/04_complex_queries.sql) | Ten complex business queries (CQ-01–CQ-10) |
| [queries.md](./queries.md) | Index of every query identifier |
| [PHASE1_REVIEW_NOTES.md](./PHASE1_REVIEW_NOTES.md) | Static review, audit corrections and execution verification log |
| [results/](./results/) | Actual psql output (SQL echoed + result tables) from the verification run |

Later review topics (views, procedures, functions, triggers, cursors, SQL roles, EXPLAIN packs) are **out of scope** for this phase and are not implemented here.

## Current schema (authoritative sources)

The application manages PostgreSQL through Prisma. The authority for names, types, and constraints is:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260830194500_appointment_workflow_foundation/migration.sql`

Ten principal tables: `users`, `patients`, `departments`, `doctors`, `doctor_availability`, `appointments`, `feedback`, `queries`, `chat_conversations`, `chat_messages`.

Five ENUM types: `Role`, `Gender`, `AppointmentStatus`, `QueryStatus`, `MessageRole`.

Double-booking of **active** appointment slots is prevented by the **partial** unique index `appointments_active_doctor_slot_unique`. Cancelled slots may be reused. That index is reproduced in `01_ddl.sql`; it is **not** replaced by a full unique constraint.

## Intended execution order

Use a **dedicated, empty, disposable** PostgreSQL 15 database. Do **not** run these scripts against `medicore_db` used by the Node/Prisma application.

Suggested local setup (example only; adjust names as needed):

```sql
-- Run as a PostgreSQL superuser on a throwaway instance, not on the app database.
CREATE DATABASE medicore_dbms_review;
```

Then, from the repository root:

```bash
psql -d medicore_dbms_review -v ON_ERROR_STOP=1 -f docs/dbms/sql/01_ddl.sql
psql -d medicore_dbms_review -v ON_ERROR_STOP=1 -f docs/dbms/sql/02_dml.sql
psql -d medicore_dbms_review -v ON_ERROR_STOP=1 -f docs/dbms/sql/03_sql_queries.sql
psql -d medicore_dbms_review -v ON_ERROR_STOP=1 -f docs/dbms/sql/04_complex_queries.sql
```

1. **01_ddl.sql** — create extension, ENUMs, tables, indexes, foreign keys. Intended for an **empty** database. Re-running it on a database that already has these types/tables will fail (no `DROP DATABASE` / `DROP TABLE` is included).
2. **02_dml.sql** — load demonstration rows. Setup `INSERT` statements use `ON CONFLICT` on fixed primary keys so the setup section can be repeated against the same intact demonstration dataset. The UPDATE/DELETE section is wrapped in a transaction that **rolls back** by default. The dataset includes (a) a patient with both unread feedback and an active support query, (b) an active doctor with availability but no upcoming appointment, and (c) two active same-day appointments for the window-function schedule example. These are demonstration-only records.
3. **03_sql_queries.sql** and **04_complex_queries.sql** — read-mostly query packs. They assume the demonstration data from `02_dml.sql` exists. They do not modify schema.

`01_ddl.sql` does **not** include `DROP DATABASE` or other destructive reset commands.

## Disposable development database (required)

These scripts exist for academic demonstration. Running DDL on the Prisma-managed application database can:

- conflict with `_prisma_migrations`
- fail on existing types and tables
- confuse Prisma migrate

Running DML on the application database can insert extra rows that the UI and Jest fixtures do not expect.

**Requirement:** test only on a disposable database that you are willing to drop.

## What this phase does not do

- It does not change Prisma schema, migrations, seed, backend, frontend, Docker, or environment files.
- It does not implement views, stored procedures, user-defined functions, triggers, cursors, or extra database roles.
- It does not add CHECK constraints that are absent from the current migration.
## Execution status

All four scripts were executed on **PostgreSQL 15.15** on 2026-10-10. They ran in a disposable Docker container (`postgres:15`, database `medicore_dbms_test`, no published port, no named volume) with `ON_ERROR_STOP=1`. Every script exited with code 0 and no errors. See [PHASE1_REVIEW_NOTES.md](./PHASE1_REVIEW_NOTES.md) for the details and [results/](./results/) for the raw output.

If `psql` is not installed locally, the same run can be reproduced through Docker from the repository root:

```bash
docker run -d --name medicore_dbms_test -e POSTGRES_PASSWORD=<any-local-value> -e POSTGRES_DB=medicore_dbms_test postgres:15
docker exec -i medicore_dbms_test psql -U postgres -d medicore_dbms_test -v ON_ERROR_STOP=1 -X -e < docs/dbms/sql/01_ddl.sql
```

Repeat the second command for `02_dml.sql`, `03_sql_queries.sql` and `04_complex_queries.sql`. Remove the container afterwards with `docker rm -f medicore_dbms_test`.
