#!/usr/bin/env bash
# Runs MediCore DBMS SQL scripts inside a disposable PostgreSQL Docker container
# and captures the echoed SQL + output as evidence under docs/dbms/results/.
#
# Usage (from the repository root, Git Bash / Linux / macOS):
#   docs/dbms/run_dbms_scripts.sh [--create] <container> <database> <file.sql>...
#
#   --create   create <database> first; aborts if it already exists
#              (this script never drops a database).
#
# Example — full clean build of the assessment database:
#   docs/dbms/run_dbms_scripts.sh --create medicore_dbms_test medicore_dbms_demo \
#     docs/dbms/sql/01_ddl.sql docs/dbms/sql/02_dml.sql docs/dbms/sql/02_dml.sql \
#     docs/dbms/sql/03_sql_queries.sql docs/dbms/sql/04_complex_queries.sql ...
#
# Safety guard: the target database name must start with "medicore_dbms_".
# The application database (medicore_db) can never be targeted.

set -uo pipefail

create=0
if [[ "${1:-}" == "--create" ]]; then create=1; shift; fi
if [[ $# -lt 3 ]]; then
  echo "usage: $0 [--create] <container> <database> <file.sql>..." >&2
  exit 2
fi

container="$1"; db="$2"; shift 2

if [[ ! "$db" =~ ^medicore_dbms_[a-z0-9_]+$ ]]; then
  echo "refusing: database '$db' is not a dedicated medicore_dbms_* test database" >&2
  exit 2
fi

psql_base=(docker exec -i "$container" psql -U postgres -X -v ON_ERROR_STOP=1)

if [[ $create -eq 1 ]]; then
  exists=$("${psql_base[@]}" -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$db'") || exit 1
  if [[ "$exists" == "1" ]]; then
    echo "refusing: database '$db' already exists; choose a new name" >&2
    exit 2
  fi
  "${psql_base[@]}" -d postgres -qc "CREATE DATABASE \"$db\"" || exit 1
fi

current=$("${psql_base[@]}" -d "$db" -Atc "SELECT current_database()") || exit 1
if [[ "$current" != "$db" ]]; then
  echo "refusing: connected to '$current', expected '$db'" >&2
  exit 2
fi

results_dir="$(cd "$(dirname "$0")" && pwd)/results"
mkdir -p "$results_dir"
server=$("${psql_base[@]}" -d "$db" -Atc "SELECT version()")
declare -A seen=()
overall=0

for file in "$@"; do
  base=$(basename "$file" .sql)
  seen[$base]=$(( ${seen[$base]:-0} + 1 ))
  suffix="run"; [[ ${seen[$base]} -gt 1 ]] && suffix="run${seen[$base]}"
  out="$results_dir/${base}_${suffix}.txt"
  {
    echo "-- MediCore DBMS execution evidence"
    echo "-- Run (UTC): $(date -u +%FT%TZ)"
    echo "-- Container: $container   Database: $db"
    echo "-- Server: $server"
    echo "-- psql flags: -X -v ON_ERROR_STOP=1 -e"
    echo "-- File: $file"
    echo
    "${psql_base[@]}" -d "$db" -e < "$file" 2>&1
    echo "EXIT_CODE=$?"
  } > "$out"
  code=$(grep -o 'EXIT_CODE=[0-9]*' "$out" | tail -1 | cut -d= -f2)
  if [[ "$code" == "0" ]]; then status=PASS; else status=FAIL; overall=1; fi
  printf '%-4s  %-40s -> %s\n' "$status" "$file" "${out#"$results_dir"/}"
  [[ $status == FAIL ]] && break
done

exit $overall
