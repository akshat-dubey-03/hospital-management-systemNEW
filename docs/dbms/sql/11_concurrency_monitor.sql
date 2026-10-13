-- Concurrency demo — MONITOR (run while session B is waiting).
-- Shows which backend is blocked, on what, and by whom.
SELECT a.pid,
       a.wait_event_type,
       a.wait_event,
       pg_blocking_pids(a.pid) AS blocked_by,
       left(regexp_replace(a.query, '\s+', ' ', 'g'), 70) AS query
FROM pg_stat_activity a
WHERE a.datname = current_database()
  AND a.pid <> pg_backend_pid()
  AND a.backend_type = 'client backend'
ORDER BY a.pid;
