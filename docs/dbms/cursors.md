# Cursor demonstrations (Phase 8)

Script: `sql/09_cursors.sql` (standalone; cursors are session objects, not schema objects, so there is no migration). Evidence: `results/09_cursors_run.txt` (PostgreSQL 15.15). Both examples are read-only. The script ends by showing the appointment count unchanged (15) and 0 audit rows.

## Cursor 1 — SQL-level `SCROLL` cursor (paging upcoming appointments)

```sql
BEGIN;
DECLARE upcoming_cur SCROLL CURSOR FOR
  SELECT ... FROM vw_dbms_appointment_details
  WHERE status_group = 'ACTIVE' AND appointment_date >= DATE '2026-10-01'
  ORDER BY appointment_date, start_time, appointment_id;
FETCH 3 FROM upcoming_cur;        -- page 1
FETCH 3 FROM upcoming_cur;        -- page 2
FETCH PRIOR FROM upcoming_cur;    -- step back (needs SCROLL)
MOVE FORWARD 1 IN upcoming_cur;   -- skip without returning
FETCH NEXT FROM upcoming_cur;
FETCH ALL FROM upcoming_cur;      -- the rest
FETCH NEXT FROM upcoming_cur;     -- exhausted: (0 rows)
FETCH ABSOLUTE 1 FROM upcoming_cur;
CLOSE upcoming_cur;
COMMIT;
```

- **Transaction scope:** a cursor without `WITH HOLD` exists only inside a transaction block. `DECLARE` outside `BEGIN … COMMIT` is an error, and `COMMIT`/`ROLLBACK` closes any open cursor. `WITH HOLD` would keep it after commit by materialising the result.
- **Detecting exhaustion:** in SQL, a `FETCH` returns 0 rows. In PL/pgSQL, `FOUND` becomes false.
- **Determinism:** the cursor has an explicit `ORDER BY` ending in the unique `appointment_id`. Without it, the fetch order would be unspecified.
- **`pg_cursors`:** shows the open cursor as `is_scrollable = t`, `is_holdable = f`.

## Cursor 2 — parameterised PL/pgSQL cursor (per-doctor workload report)

`doctor_cur CURSOR (p_active BOOLEAN) FOR SELECT … FROM vw_dbms_doctor_appointment_stats WHERE doctor_is_active = p_active ORDER BY department_name, doctor_name`

The block runs `OPEN doctor_cur(TRUE)`, then loops: `FETCH … INTO rec; EXIT WHEN NOT FOUND`. For each doctor it labels the workload HIGH / NORMAL / IDLE from the pipeline count, and prints a department subtotal whenever the department changes ("control-break" processing). It finishes with a grand total, then `CLOSE`.

Output: 5 active doctors and 15 appointments. Cardiology/Sharma is HIGH, Dermatology/Rao is IDLE, and the rest are NORMAL.

## Why set-based SQL is normally preferable

Each example in the script is followed by its set-based equivalent:

- **Paging:** `LIMIT 3 OFFSET 3` returns page 2 in one statement. Keyset pagination (`WHERE (date, time, id) > (last values)`) scales better still.
- **Report:** one `GROUP BY GROUPING SETS ((department, doctor), (department), ())` query produces the same labels, subtotals and grand total. The result matched the cursor's output exactly.

A row-by-row loop does one fetch per row, keeps state in procedural variables, and hides the whole-query shape from the planner. A single set-based statement lets PostgreSQL choose join and aggregation strategies and use indexes. Cursors earn their place when a client must consume a very large result incrementally (bounded memory), or when each row needs procedural side effects that cannot be written as one statement.
