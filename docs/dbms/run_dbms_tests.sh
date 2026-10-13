#!/usr/bin/env bash
# MediCore DBMS test runner.
#
# Usage (repository root, Git Bash / Linux / macOS):
#   docs/dbms/run_dbms_tests.sh <container> <new_database_name>
#
# 1. Builds a NEW disposable database <new_database_name> (must match
#    medicore_dbms_*; refuses if it already exists) in <container> from
#    01, 02, 06, 07, 08, 10 and 12.
# 2. Runs the SQL assertion suite docs/dbms/tests/dbms_tests.sql (T01-T19).
# 3. Runs the cases that need more than one session or the application:
#      T20 two-session duplicate-slot race          (always)
#      T21 seed.js repeatability (two runs)          needs DBMS_APP_TEST_URL
#      T22 Jest guard refuses medicore_db            needs backend/node_modules
#      T23 application Jest suites through the guard needs DBMS_APP_TEST_URL
#    DBMS_APP_TEST_URL is a Prisma connection URL to a migrated database whose
#    name contains "test", reachable from this machine; DBMS_APP_CONTAINER
#    (default medicore_dbms_prisma) is the Docker container hosting it. Missing
#    prerequisites are reported as NOT RUN, never as PASS. URLs are never
#    printed.
# Output: docs/dbms/results/dbms_tests_run.txt

set -uo pipefail
container="${1:?container}"; db="${2:?database}"
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../.." && pwd)"
out="$here/results/dbms_tests_run.txt"
tmp="$(mktemp -d)"
declare -a extra_rows=()

if [[ ! "$db" =~ ^medicore_dbms_[a-z0-9_]+$ ]]; then
  echo "refusing: '$db' is not a medicore_dbms_* test database" >&2; exit 2
fi
psql_admin=(docker exec -i "$container" psql -U postgres -X -v ON_ERROR_STOP=1)
if [[ "$("${psql_admin[@]}" -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$db'")" == "1" ]]; then
  echo "refusing: database '$db' already exists; choose a new name" >&2; exit 2
fi
psql_db=(docker exec -i "$container" psql -U postgres -X -v ON_ERROR_STOP=1 -d "$db")

record() { extra_rows+=("$(printf '%-4s | %-12s | %-8s | %s' "$1" "$2" "$3" "$4")"); }

{
  echo "-- MediCore DBMS test suite run"
  echo "-- Run (UTC): $(date -u +%FT%TZ)   Container: $container   Database: $db"
  echo "-- Server: $("${psql_admin[@]}" -d postgres -Atc 'SELECT version()')"
  echo

  # ---- 1. build -----------------------------------------------------------
  echo "==== Setup: CREATE DATABASE + 01, 02, 06, 07, 08, 10, 12"
  "${psql_admin[@]}" -d postgres -qc "CREATE DATABASE \"$db\""
  for f in 01_ddl 02_dml 06_views 07_procedures_functions 08_triggers 10_security 12_indexing_explain; do
    if "${psql_db[@]}" -q < "$here/sql/$f.sql" > "$tmp/$f.log" 2>&1; then
      echo "setup ok: $f.sql"
    else
      echo "SETUP FAILED: $f.sql"; tail -5 "$tmp/$f.log"; exit 1
    fi
  done

  # ---- 2. SQL assertion suite ---------------------------------------------
  echo
  echo "==== SQL assertion suite: docs/dbms/tests/dbms_tests.sql"
  "${psql_db[@]}" < "$here/tests/dbms_tests.sql" 2>&1 | grep -v -E '^(CREATE FUNCTION|CREATE TABLE|DO)$'
  sql_exit=${PIPESTATUS[0]}
  echo "SQL_SUITE_EXIT_CODE=$sql_exit"

  # ---- 3a. T20 concurrency ------------------------------------------------
  echo
  echo "==== T20 two concurrent sessions book the same slot (A commits)"
  "${psql_db[@]}" -qc "DELETE FROM appointments WHERE id IN ('00000000-0000-4000-a000-0000000005c1','00000000-0000-4000-a000-0000000005c2')"
  docker exec -i "$container" psql -U postgres -X -d "$db" -v hold=3 -v finish=COMMIT \
    < "$here/sql/11_concurrency_session_a.sql" > "$tmp/a.txt" 2>&1 &
  pa=$!; sleep 1
  docker exec -i "$container" psql -U postgres -X -d "$db" \
    < "$here/sql/11_concurrency_session_b.sql" > "$tmp/b.txt" 2>&1 &
  pb=$!; sleep 1
  waiting=$("${psql_db[@]}" -Atc "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND cardinality(pg_blocking_pids(pid)) > 0")
  wait "$pa"; wait "$pb"
  rows=$("${psql_db[@]}" -Atc "SELECT COUNT(*) FROM appointments WHERE \"doctorId\" = '00000000-0000-4000-a000-000000000306' AND \"appointmentDate\" = DATE '2026-12-04' AND \"startTime\" = '10:00'")
  echo "sessions blocked on a lock while A was open: $waiting"
  grep -E "ERROR|DETAIL" "$tmp/b.txt" || echo "(session B reported no error)"
  echo "rows in the contested slot afterwards: $rows"
  "${psql_db[@]}" -qc "DELETE FROM appointments WHERE id IN ('00000000-0000-4000-a000-0000000005c1','00000000-0000-4000-a000-0000000005c2')"
  if [[ "$waiting" -ge 1 && "$rows" == "1" ]] && grep -q 'appointments_active_doctor_slot_unique' "$tmp/b.txt"; then
    record T20 Concurrency PASS "B blocked on A's uncommitted insert, then got 23505; exactly 1 row in the slot"
  else
    record T20 Concurrency FAIL "waiting=$waiting rows=$rows"
  fi

  # ---- 3b. T21 seed repeatability ------------------------------------------
  echo
  echo "==== T21 seed.js run twice -> identical row counts"
  app_container="${DBMS_APP_CONTAINER:-medicore_dbms_prisma}"
  if [[ -z "${DBMS_APP_TEST_URL:-}" || ! -d "$repo/backend/node_modules" ]]; then
    echo "NOT RUN: DBMS_APP_TEST_URL not set or backend/node_modules missing"
    record T21 Seed "NOT RUN" "needs DBMS_APP_TEST_URL and backend dependencies"
  else
    app_db="$(node -e 'console.log(decodeURIComponent(new URL(process.argv[1]).pathname.slice(1)))' "$DBMS_APP_TEST_URL")"
    if [[ ! "$app_db" =~ test ]]; then
      echo "refusing seed test: database name '$app_db' does not contain 'test'"
      record T21 Seed FAIL "unsafe target database name"
    else
      for i in 1 2; do
        (cd "$repo/backend" && DATABASE_URL="$DBMS_APP_TEST_URL" SEED_ANCHOR_DATE=2026-10-12 node prisma/seed.js > "$tmp/seed$i.log" 2>&1)
        docker exec -i "$app_container" psql -U postgres -X -d "$app_db" -At < "$here/sql/seed_row_counts.sql" > "$tmp/counts$i.txt" 2>&1
      done
      echo "database: $app_db"; cat "$tmp/counts2.txt"
      if grep -q "Seed completed" "$tmp/seed1.log" && grep -q "Seed completed" "$tmp/seed2.log" \
         && diff -q "$tmp/counts1.txt" "$tmp/counts2.txt" > /dev/null; then
        record T21 Seed PASS "two consecutive seed runs: identical counts, duplicate checks 0"
      else
        record T21 Seed FAIL "seed failed or counts differ"
      fi
    fi
  fi

  # ---- 3c. T22 Jest guard -----------------------------------------------------
  echo
  echo "==== T22 Jest refuses a non-test database"
  if [[ ! -d "$repo/backend/node_modules" ]]; then
    echo "NOT RUN: backend/node_modules missing"
    record T22 Isolation "NOT RUN" "needs backend dependencies"
  else
    (cd "$repo/backend" && env -u DATABASE_URL JWT_SECRET=x REFRESH_TOKEN_SECRET=y \
       TEST_DATABASE_URL="postgresql://u:p@guard-check.invalid:5432/medicore_db" \
       node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand src/modules/auth > "$tmp/guard.log" 2>&1)
    grep -m1 -o 'Refusing to run tests against database "medicore_db"[^.]*' "$tmp/guard.log" || true
    if grep -q 'Refusing to run tests against database "medicore_db"' "$tmp/guard.log"; then
      record T22 Isolation PASS "Jest setup guard refused medicore_db before connecting"
    else
      record T22 Isolation FAIL "guard message not found"
    fi
  fi

  # ---- 3d. T23 application suites ------------------------------------------
  echo
  echo "==== T23 application Jest suites through the guard"
  if [[ -z "${DBMS_APP_TEST_URL:-}" || ! -d "$repo/backend/node_modules" ]]; then
    echo "NOT RUN: DBMS_APP_TEST_URL not set or backend/node_modules missing"
    record T23 App "NOT RUN" "needs DBMS_APP_TEST_URL and backend dependencies"
  else
    (cd "$repo/backend" && env -u DATABASE_URL TEST_DATABASE_URL="$DBMS_APP_TEST_URL" \
       JWT_SECRET="$(head -c 32 /dev/urandom | base64)" REFRESH_TOKEN_SECRET="$(head -c 32 /dev/urandom | base64)" \
       node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --silent > "$tmp/jest.log" 2>&1)
    grep -E "^(PASS|FAIL) |^Tests:|^Test Suites:" "$tmp/jest.log"
    if grep -q "^Tests: .* passed, .* total" "$tmp/jest.log" && ! grep -q "failed" "$tmp/jest.log"; then
      record T23 App PASS "$(grep '^Tests:' "$tmp/jest.log")"
    else
      record T23 App FAIL "$(grep '^Tests:' "$tmp/jest.log" || echo 'no summary')"
    fi
  fi

  # ---- summary --------------------------------------------------------------
  echo
  echo "==== Multi-session / application cases"
  echo "case | area         | status   | detail"
  for r in "${extra_rows[@]}"; do echo "$r"; done
} > "$out" 2>&1

rm -rf "$tmp"
grep -E "^ T[0-9]+ |^T2[0-9] |passed \| failed|^ +[0-9]+ \| +[0-9]+ \| +[0-9]+$|SQL_SUITE_EXIT_CODE|SETUP FAILED" "$out"
echo "written: $out"
