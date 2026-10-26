# Stored procedures and user-defined functions (Phase 6)

Definitions are in migration `backend/prisma/migrations/20261011120000_dbms_routines/migration.sql`. The same text, plus tests, is in `sql/07_procedures_functions.sql`. Evidence: `results/07_procedures_functions_run.txt` (PostgreSQL 15.15).

**The application does not call these routines.** No Express route was changed. They apply the same business rules as `appointments.routes.js`, so a SQL-level caller cannot bypass them.

## Signatures

| Routine | Kind | Signature | Volatility | Security |
|---|---|---|---|---|
| `sp_cancel_appointment` | procedure | `(p_appointment_id uuid, p_cancel_status "AppointmentStatus", p_reason text DEFAULT NULL, p_as_of timestamptz DEFAULT now())` | volatile (writes) | SECURITY DEFINER, `search_path` pinned, EXECUTE revoked from PUBLIC |
| `sp_respond_to_query` | procedure | `(p_query_id uuid, p_status "QueryStatus", p_response text DEFAULT NULL)` | volatile (writes) | same |
| `fn_doctor_completed_count` | function → integer | `(p_doctor_id uuid)` | STABLE (read-only) | invoker |
| `fn_patient_upcoming_count` | function → integer | `(p_patient_id uuid, p_as_of date DEFAULT CURRENT_DATE)` | STABLE (read-only) | invoker |

Writes are procedures, not functions, so nothing that modifies data looks like a read-only helper. Both functions are `STABLE` and can be used in `SELECT` lists and `WHERE` clauses.

## Behaviour and error contract

| SQLSTATE | Name | Raised when |
|---|---|---|
| 22004 | `null_value_not_allowed` | required id/status argument is NULL |
| 22023 | `invalid_parameter_value` | cancel status is not CANCELLED_*; query status OPEN; RESOLVED without a response |
| P0002 | `no_data_found` | appointment / query id does not exist |
| 55000 | `object_not_in_prerequisite_state` | appointment not BOOKED/CONFIRMED (incl. repeated cancel), appointment already started, query CLOSED |

**`sp_cancel_appointment`**
- Locks the row with `SELECT … FOR UPDATE`, so concurrent cancels or status changes run one after the other. The second caller sees the new status and is refused.
- Sets `status`, the trimmed `cancellationReason` (blank becomes NULL), `cancelledAt = now()` and `updatedAt = now()`. `updatedAt` must be set explicitly: Prisma's `@updatedAt` happens client-side and is not a column default.
- The "already started" rule compares against `p_as_of`. That defaults to `now()`, and tests pass a fixed time so the results are reproducible.
- The freed slot can be rebooked straight away, because the partial unique index ignores cancelled rows (test P1-3).

**`sp_respond_to_query`**
- Moves a query to IN_PROGRESS, RESOLVED or CLOSED.
- A non-blank response sets `adminResponse` and `respondedAt`. A NULL response leaves both unchanged.
- CLOSED is terminal: a closed query cannot be changed.

**Functions**
- Both return **NULL for an unknown id**, so "no such doctor/patient" is distinguishable from 0.
- `fn_patient_upcoming_count` counts BOOKED/CONFIRMED appointments on or after `p_as_of`.

## Transactions

The procedures contain no `COMMIT`/`ROLLBACK`; the caller owns the transaction.

- `BEGIN; CALL …; ROLLBACK;` fully undoes a call (tests P1-4 and R-9).
- PostgreSQL allows transaction control inside a procedure only when it is `CALL`ed outside an explicit transaction block. A `SECURITY DEFINER` procedure cannot use transaction control at all, so these procedures never need it.
- When a call fails, only the calling statement is rolled back. Inside a `DO` block or a `SAVEPOINT`, the surrounding transaction can continue.

## Test results (2026-10-11)

| ID | Case | Result |
|---|---|---|
| F-1 | completed count per doctor = direct `COUNT(*)` (6 doctors) | PASS |
| F-1 | unknown doctor → NULL | PASS |
| F-2 | upcoming count, as-of 2026-10-01 and 2026-10-16; used in WHERE | PASS |
| F-2 | unknown patient → NULL | PASS |
| P1-1 | valid cancel sets status / reason (trimmed) / cancelledAt / updatedAt | PASS |
| P1-2 | repeated cancel refused (55000) | PASS |
| P1-3 | cancelled slot rebookable (2 rows in slot, 1 active) | PASS |
| P1-4 | ROLLBACK restores BOOKED state | PASS |
| P1-5 | completed appointment refused (55000) | PASS |
| P1-6 | started appointment refused (55000) | PASS |
| P1-7 | unknown id (P0002) | PASS |
| P1-8 | non-cancel status (22023) | PASS |
| P1-9 | NULL id (22004) | PASS |
| P2-1 | resolve with response sets respondedAt | PASS |
| P2-2 | IN_PROGRESS without response leaves response NULL | PASS |
| P2-3 | RESOLVED with blank response (22023) | PASS |
| P2-4 | back to OPEN (22023) | PASS |
| P2-5 | CLOSED is terminal (55000) | PASS |
| P2-6 | unknown query (P0002) | PASS |
| R-9 | demo data unchanged afterwards | PASS |

Also verified: `prisma migrate deploy` applied the migration, `prisma migrate diff` reports no drift, and the Jest suites still pass 23/23.
