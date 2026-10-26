# Views (Phase 5)

The definitions are in migration `backend/prisma/migrations/20261011110000_dbms_views/migration.sql`. The same text, plus demonstrations, is in `sql/06_views.sql`. Evidence: `results/06_views_run.txt` (PostgreSQL 15.15). The application does not use these views, and Prisma 5 ignores views when diffing: `prisma migrate diff` reports no difference.

| View | Requirement met | Base tables | Updatable? |
|------|-----------------|-------------|------------|
| `vw_dbms_appointment_details` | Joins ≥ 3 tables | appointments, patients, doctors, departments | No |
| `vw_dbms_doctor_appointment_stats` | Aggregated view | doctors, departments, appointments | No |
| `vw_dbms_public_doctor_directory` | Security / row- and column-restricting | doctors, users, departments | No |

**Why none is updatable.** PostgreSQL auto-updates a view only if it reads from exactly one table or view, with no aggregates, GROUP BY, DISTINCT, window functions or set operations. All three join several tables, and the statistics view also aggregates. `information_schema.views` reports `is_updatable = NO` for each, and an `UPDATE` through the directory view fails with `cannot update view`. Making them writable would need `INSTEAD OF` triggers, which is deliberately not done: writes go through the application or the stored procedures.

## 1. `vw_dbms_appointment_details`
One row per appointment. Columns: `appointment_id`, date and times, `status`, `status_group` (ACTIVE / COMPLETED / CANCELLED), reason, cancellation reason, patient id and name, doctor id and name, specialization, department id and name.

It excludes the doctor-only `notes` column and every patient contact or medical field.

Verified: 15 rows, equal to the 4-table base join, with 0 mismatched rows (symmetric `EXCEPT`).

```sql
SELECT appointment_date, start_time, patient_name, doctor_name, department_name
FROM vw_dbms_appointment_details
WHERE status_group = 'ACTIVE' ORDER BY appointment_date, start_time;
```

## 2. `vw_dbms_doctor_appointment_stats`
One row per doctor. A LEFT JOIN means doctors with no appointments show zeros.

Columns: total, booked, confirmed, completed and cancelled counts; distinct patients; `completion_rate_pct` (NULL when there are no appointments); `estimated_completed_fees`; and `last_completed_date`.

The fee figure is completed visits × the doctor's *current* fee. It is an estimate, not revenue: the schema has no invoice or billing table.

Verified: every doctor's total and completed counts match a direct `GROUP BY` on `appointments` (`matches = t` for all 6).

## 3. `vw_dbms_public_doctor_directory` (`security_barrier = true`)
- **Rows:** only doctors with `doctors.isActive` and `users.isActive` both true. Verified: inactive Dr Gupta is absent and the other 5 are present.
- **Columns:** name, specialization, qualification, experience, fee, slot length and department. No phone, email, `userId` or password data.
- **What `security_barrier` guarantees:** the view's own `WHERE` runs before any condition the caller adds. The demonstration shows this with a function that reports every row it sees. Through an identical view *without* the barrier, it saw the hidden doctor (Gupta). Through the barrier view it saw only visible rows. `EXPLAIN` shows the caller's filter kept above the view in a `Subquery Scan`.
- **What it does not guarantee:** it does not grant or deny anything by itself. Access control comes from privileges: Phase 9 grants `SELECT` on this view, but not on the base tables, to restricted roles. It is also not per-user row-level security (RLS). It cannot tell which patient or doctor is logged in to the Express app, because the app uses one shared database connection.
- **Owner rights:** views run with their owner's privileges (`security_invoker` is off). That is what lets a role with access to the view, but not to the base tables, read it.
