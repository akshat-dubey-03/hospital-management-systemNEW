# Transactions, failure/rollback and concurrency (Phase 10)

Scripts: `sql/11_transactions.sql` (single session), plus `run_concurrency_demo.sh` with `sql/11_concurrency_*.sql` (genuinely concurrent psql sessions). Evidence: `results/11_transactions_run.txt` and `results/11_concurrency_run.txt` (PostgreSQL 15.15, isolation level **read committed**, the PostgreSQL default). Everything ran in the disposable database `medicore_dbms_p10` against known demo rows. Committed demo changes and fixture rows are restored or deleted at the end; this was verified (appointment 510 BOOKED, 0 audit rows, 0 fixtures).

## Single-session transactions (`11_transactions.sql`)

| ID | Demonstrates | Observed |
|---|---|---|
| TX-1 | `BEGIN … COMMIT` | feedback 603 `isRead` f → t, visible after COMMIT |
| TX-2 | `SAVEPOINT` + failed statement + `ROLLBACK TO SAVEPOINT` + unwanted change undone + `COMMIT` | the CHECK violation aborts the transaction (the next `SELECT 1` gets "current transaction is aborted"). `ROLLBACK TO` makes it usable again. Result: query 702 IN_PROGRESS committed; 0 bad feedback rows; all 4 chat messages still present |
| TX-3 | full `ROLLBACK` | inside: 14 appointments, 0 BOOKED, 5 audit rows. After: 15 appointments, 5 BOOKED, 0 audit rows (audit rows roll back with their trigger) |
| TX-4 | deliberate procedure failure | `sp_cancel_appointment(511)` succeeds, then `(501)` raises 55000. `COMMIT` on the aborted transaction returns **ROLLBACK**, so 511 is BOOKED again: all-or-nothing |
| TX-5 | partial unique index | cancelled slot 2026-09-14 09:00 rebooked ✔. A second active booking of the same slot is rejected (23505). An *overlapping* 09:15–09:45 booking is **accepted**: the index compares only `(doctorId, appointmentDate, startTime)`, not time ranges |

## Concurrency (`run_concurrency_demo.sh`)

Session A starts first. Session B starts one second later and targets exactly the same doctor, date and start time (Dr Rao, 2026-12-04 10:00). A third session samples `pg_stat_activity` / `pg_blocking_pids` while B is waiting.

| Scenario | What happened (timestamps from the evidence) |
|---|---|
| 1. A inserts, holds 4 s, **COMMIT** | B's INSERT **waits**. The monitor shows B: `wait_event_type = Lock`, `wait_event = transactionid`, `blocked_by = {A's pid}`. A commits at 08:53:26.123 and B immediately gets `duplicate key value violates unique constraint "appointments_active_doctor_slot_unique"` (26.124). Only A's row exists |
| 2. A inserts, holds 4 s, **ROLLBACK** | B waits the same way. A rolls back at 38.857 and B's insert succeeds at 38.882. Only B's row exists |
| 3. A and B both `CALL sp_cancel_appointment(510)` | B waits on A's row lock (`SELECT … FOR UPDATE` inside the procedure). After A commits, B re-reads the row, sees CANCELLED_BY_ADMIN, and is refused (55000). The audit trail shows exactly one change (BOOKED → CANCELLED_BY_ADMIN) |

**Why B waits.** Under read committed, B cannot see A's uncommitted row. But the unique index already holds A's pending entry, so PostgreSQL makes B wait for A's transaction to end before deciding. On COMMIT the key exists, so B fails. On ROLLBACK the entry is dead, so B proceeds. This blocks duplicate active bookings without serializable isolation or explicit locks.

**Why this matters for the app.** The API's pre-check (`findFirst` for an active slot) can pass in both requests at the same time; it is a check-then-act race. The database index is the real guarantee. Prisma surfaces the violation as error code `P2002`, which `appointments.routes.js` maps to HTTP 409 "This slot has just been booked". Both Jest's concurrent-booking test and Scenario 1 show the second writer losing cleanly.

**Isolation notes (facts vs. tested).**
- **Tested:** read committed, with the blocking and outcome shown above.
- **Not tested here:** REPEATABLE READ / SERIALIZABLE. Under those levels, Scenario 3's second session would get a serialization failure (40001) instead of re-reading the row, and the application would need to retry.
- **Known gap:** overlapping intervals (TX-5) need an exclusion constraint (`btree_gist`, time ranges). This is documented as future work, not claimed.

## Demo steps (live, ~3 minutes of the 10–12 minute demo)

1. `docs/dbms/run_dbms_scripts.sh medicore_dbms_test <db> docs/dbms/sql/11_transactions.sql`, then open the result and point at TX-2 (abort → savepoint) and TX-4 (COMMIT → ROLLBACK).
2. `docs/dbms/run_concurrency_demo.sh medicore_dbms_test <db>`, then show Scenario 1: the monitor line `Lock | transactionid | {pid}` followed by B's 23505 at the moment A commits.
3. To do it by hand instead: open two psql windows, run session A's statements up to `pg_sleep`, run session B's INSERT (it hangs), then type `COMMIT;` in A and watch B fail.
