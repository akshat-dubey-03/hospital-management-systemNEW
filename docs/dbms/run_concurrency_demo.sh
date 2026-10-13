#!/usr/bin/env bash
# Runs the two-session concurrency demonstrations against a disposable DBMS
# database and writes docs/dbms/results/11_concurrency_run.txt.
#
# Usage (repository root): docs/dbms/run_concurrency_demo.sh <container> <database>
# Prerequisites: 01, 02, 06, 07, 08 applied to <database>.
# Only test fixture rows (ids ...05c1 / ...05c2) are committed; they are
# deleted before and after. Scenario 3's committed cancellation of appointment
# 510 is restored at the end.

set -uo pipefail
container="$1"; db="$2"
if [[ ! "$db" =~ ^medicore_dbms_[a-z0-9_]+$ ]]; then
  echo "refusing: '$db' is not a medicore_dbms_* test database" >&2; exit 2
fi
here="$(cd "$(dirname "$0")" && pwd)"
sql="$here/sql"; out="$here/results/11_concurrency_run.txt"
psql=(docker exec -i "$container" psql -U postgres -X -d "$db")
tmp="$(mktemp -d)"

cleanup() {
  "${psql[@]}" -qc "DELETE FROM appointments WHERE id IN ('00000000-0000-4000-a000-0000000005c1', '00000000-0000-4000-a000-0000000005c2')"
}

slot_state() {
  "${psql[@]}" -c "SELECT right(id::text, 3) AS fixture, \"reasonForVisit\", status FROM appointments WHERE \"doctorId\" = '00000000-0000-4000-a000-000000000306' AND \"appointmentDate\" = DATE '2026-12-04' ORDER BY id"
}

# Starts session A, then B one second later, samples the monitor one second
# after that, and waits for both. $1 = how A ends: COMMIT or ROLLBACK.
run_pair() {
  "${psql[@]}" -e -v hold=4 -v finish="$1" < "$sql/11_concurrency_session_a.sql" > "$tmp/a.txt" 2>&1 &
  local pa=$!
  sleep 1
  "${psql[@]}" -e < "$sql/11_concurrency_session_b.sql" > "$tmp/b.txt" 2>&1 &
  local pb=$!
  sleep 1
  "${psql[@]}" < "$sql/11_concurrency_monitor.sql" > "$tmp/m.txt" 2>&1
  wait "$pa"; wait "$pb"
  echo "---- session A"; cat "$tmp/a.txt"
  echo "---- monitor (sampled ~1 s after B started)"; cat "$tmp/m.txt"
  echo "---- session B"; cat "$tmp/b.txt"
  echo "---- slot state afterwards"; slot_state
}

{
  echo "-- MediCore DBMS concurrency evidence (genuinely concurrent psql sessions)"
  echo "-- Run (UTC): $(date -u +%FT%TZ)   Container: $container   Database: $db"
  echo "-- Server: $("${psql[@]}" -Atc 'SELECT version()')"
  cleanup

  echo
  echo "==== Scenario 1: A inserts, holds 4 s, COMMITs; B inserts the same slot meanwhile"
  echo "     expected: B blocks until A commits, then unique_violation (appointments_active_doctor_slot_unique)"
  run_pair COMMIT
  cleanup

  echo
  echo "==== Scenario 2: same, but A ROLLs BACK"
  echo "     expected: B blocks until A rolls back, then B's insert succeeds"
  run_pair ROLLBACK
  cleanup

  echo
  echo "==== Scenario 3: two sessions cancel appointment 510 via sp_cancel_appointment"
  echo "     expected: B waits on A's row lock (FOR UPDATE), then is refused (55000) because A already cancelled"
  "${psql[@]}" -e -v who=A -v hold=4 < "$sql/11_concurrency_cancel_session.sql" > "$tmp/ca.txt" 2>&1 &
  pa=$!
  sleep 1
  "${psql[@]}" -e -v who=B -v hold=0 < "$sql/11_concurrency_cancel_session.sql" > "$tmp/cb.txt" 2>&1 &
  pb=$!
  sleep 1
  "${psql[@]}" < "$sql/11_concurrency_monitor.sql" > "$tmp/cm.txt" 2>&1
  wait "$pa"; wait "$pb"
  echo "---- session A"; cat "$tmp/ca.txt"
  echo "---- monitor (sampled ~1 s after B started)"; cat "$tmp/cm.txt"
  echo "---- session B"; cat "$tmp/cb.txt"
  echo "---- appointment 510 and its audit rows"
  "${psql[@]}" -c "SELECT status, \"cancellationReason\" FROM appointments WHERE id = '00000000-0000-4000-a000-000000000510'" \
               -c "SELECT \"oldStatus\", \"newStatus\" FROM appointment_status_audit WHERE \"appointmentId\" = '00000000-0000-4000-a000-000000000510' ORDER BY id"
  echo "---- restore appointment 510 to its 02_dml.sql state (demo cleanup)"
  "${psql[@]}" -c "UPDATE appointments SET status = 'BOOKED', \"cancellationReason\" = NULL, \"cancelledAt\" = NULL, \"updatedAt\" = TIMESTAMPTZ '2026-10-01 09:00:00+00' WHERE id = '00000000-0000-4000-a000-000000000510'" \
               -c "DELETE FROM appointment_status_audit WHERE \"appointmentId\" = '00000000-0000-4000-a000-000000000510'"
} > "$out" 2>&1

rm -rf "$tmp"
echo "written: $out"
