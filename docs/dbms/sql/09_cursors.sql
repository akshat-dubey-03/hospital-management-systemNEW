-- =============================================================================
-- MediCore HMS — Cursor demonstrations (Review 3)
-- =============================================================================
-- Run on a disposable database after 01, 02 and 06 (uses the views).
-- Both examples are READ-ONLY: no rows are inserted, updated or deleted.
-- Every cursor query has an explicit ORDER BY (with a unique tie-breaker), so
-- the fetch order is deterministic.
-- =============================================================================

-- =============================================================================
-- Cursor 1 — SQL-level SCROLL cursor over upcoming appointments
-- =============================================================================
-- Business use: a front-desk screen paging through upcoming active visits a
-- few at a time instead of loading the whole list.
--
-- Lifecycle: a plain (WITHOUT HOLD) cursor lives only inside a transaction
-- block, so BEGIN ... DECLARE ... FETCH ... CLOSE ... COMMIT. Outside a
-- transaction DECLARE fails ("can only be used in transaction blocks").
-- SCROLL allows moving backwards (FETCH PRIOR / MOVE BACKWARD).
-- Exhaustion: FETCH past the end returns 0 rows (in PL/pgSQL: FOUND = false).

BEGIN;

DECLARE upcoming_cur SCROLL CURSOR FOR
  SELECT appointment_date, start_time, doctor_name, department_name, patient_name, status
  FROM "vw_dbms_appointment_details"
  WHERE status_group = 'ACTIVE'
    AND appointment_date >= DATE '2026-10-01'
  ORDER BY appointment_date, start_time, appointment_id;

-- Page 1: first three rows.
FETCH 3 FROM upcoming_cur;

-- Page 2: next three rows.
FETCH 3 FROM upcoming_cur;

-- Step back one row (SCROLL cursor).
FETCH PRIOR FROM upcoming_cur;

-- Skip forward one row without returning it, then read the next one.
MOVE FORWARD 1 IN upcoming_cur;
FETCH NEXT FROM upcoming_cur;

-- Everything that is left.
FETCH ALL FROM upcoming_cur;

-- Exhausted: further fetches return 0 rows.
FETCH NEXT FROM upcoming_cur;

-- Rewind to the first row with an absolute position.
FETCH ABSOLUTE 1 FROM upcoming_cur;

-- Open cursors in this session (pg_cursors) before closing.
SELECT name, is_scrollable, is_holdable, statement LIKE '%ORDER BY%' AS has_order_by
FROM pg_cursors;

CLOSE upcoming_cur;
COMMIT;

-- Set-based alternative: the same rows in one statement; paging would be done
-- with LIMIT/OFFSET or (better) keyset pagination on (date, time, id).
SELECT appointment_date, start_time, doctor_name, department_name, patient_name, status
FROM "vw_dbms_appointment_details"
WHERE status_group = 'ACTIVE' AND appointment_date >= DATE '2026-10-01'
ORDER BY appointment_date, start_time, appointment_id
LIMIT 3 OFFSET 3;

-- =============================================================================
-- Cursor 2 — parameterised PL/pgSQL cursor: per-doctor workload report
-- =============================================================================
-- Business use: a nightly report that walks each doctor's summary row, labels
-- the workload, and reports department subtotals as it goes (control-break
-- processing — the classic cursor pattern).
--
-- Lifecycle inside PL/pgSQL: DECLARE cur CURSOR (params) FOR ...; OPEN cur(args);
-- LOOP FETCH cur INTO rec; EXIT WHEN NOT FOUND; ... END LOOP; CLOSE cur.
-- A DO block runs in its own (implicit) transaction; the cursor is closed
-- explicitly and would also be closed automatically at transaction end.

DO $$
DECLARE
  -- Parameterised cursor: only doctors whose active flag matches p_active.
  doctor_cur CURSOR (p_active BOOLEAN) FOR
    SELECT doctor_name, department_name, total_appointments, booked_count + confirmed_count AS pipeline,
           completed_count, cancelled_count
    FROM "vw_dbms_doctor_appointment_stats"
    WHERE doctor_is_active = p_active
    ORDER BY department_name, doctor_name;
  rec            RECORD;
  current_dept   TEXT := NULL;
  dept_total     INTEGER := 0;
  grand_total    INTEGER := 0;
  doctors_seen   INTEGER := 0;
  workload       TEXT;
BEGIN
  OPEN doctor_cur(TRUE);
  LOOP
    FETCH doctor_cur INTO rec;
    EXIT WHEN NOT FOUND;                       -- cursor exhausted

    -- Control break: department changed -> print previous subtotal.
    IF current_dept IS NOT NULL AND rec.department_name <> current_dept THEN
      RAISE NOTICE '   subtotal %: % appointments', current_dept, dept_total;
      dept_total := 0;
    END IF;
    current_dept := rec.department_name;

    workload := CASE
                  WHEN rec.pipeline >= 3 THEN 'HIGH'
                  WHEN rec.pipeline >= 1 THEN 'NORMAL'
                  ELSE 'IDLE'
                END;
    RAISE NOTICE '% | % | total=% pipeline=% completed=% cancelled=% | workload=%',
      rpad(rec.department_name, 11), rpad(rec.doctor_name, 13), rec.total_appointments,
      rec.pipeline, rec.completed_count, rec.cancelled_count, workload;

    dept_total   := dept_total + rec.total_appointments;
    grand_total  := grand_total + rec.total_appointments;
    doctors_seen := doctors_seen + 1;
  END LOOP;
  IF current_dept IS NOT NULL THEN
    RAISE NOTICE '   subtotal %: % appointments', current_dept, dept_total;
  END IF;
  CLOSE doctor_cur;

  RAISE NOTICE 'active doctors processed: %, appointments: %', doctors_seen, grand_total;
END $$;

-- Set-based alternative: one statement produces the same labels plus the
-- department subtotals and grand total via GROUPING SETS — no row-by-row loop,
-- and the planner can optimise it as a whole.
SELECT COALESCE(department_name, '(all)') AS department,
       COALESCE(doctor_name, '(subtotal)') AS doctor,
       SUM(total_appointments) AS total,
       SUM(booked_count + confirmed_count) AS pipeline,
       CASE WHEN doctor_name IS NULL THEN NULL
            WHEN SUM(booked_count + confirmed_count) >= 3 THEN 'HIGH'
            WHEN SUM(booked_count + confirmed_count) >= 1 THEN 'NORMAL'
            ELSE 'IDLE' END AS workload
FROM "vw_dbms_doctor_appointment_stats"
WHERE doctor_is_active
GROUP BY GROUPING SETS ((department_name, doctor_name), (department_name), ())
ORDER BY department_name NULLS LAST, doctor_name NULLS LAST;

-- Proof that nothing was modified by either cursor example.
SELECT (SELECT COUNT(*) FROM "appointments") AS appointments,
       (SELECT COUNT(*) FROM "appointment_status_audit") AS audit_rows;
