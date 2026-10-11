# Repeatable seed and test-database isolation (Phase 4)

## What changed in `backend/prisma/seed.js`

| Concern (verified in the old seed) | Fix |
|---|---|
| Appointments, feedback, queries and chat used `create`/`createMany`, so every run added another copy | Every row is now an `upsert`. Users, departments, doctors, patients and availability keep their natural unique keys (email, name, userId, doctor+day+start). Appointments, feedback, queries, the conversation and its messages use fixed demo UUIDs `00000000-0000-4000-b000-…` |
| Dates came from local "today ± n days" and could fall on days the doctor does not work | One anchor date (`SEED_ANCHOR_DATE=YYYY-MM-DD`, default today in UTC). Each appointment is snapped to a weekday on which that doctor has an availability block covering the slot |
| A failure partway left half a dataset | All writes run in one `prisma.$transaction` (60 s timeout). bcrypt hashing is done once, before the transaction |
| `cancelledAt`, `respondedAt` and chat timestamps used `new Date()` | Derived from the anchor date, so they are deterministic |
| No `prisma db seed` registration | `"prisma": { "seed": "node prisma/seed.js" }` in `backend/package.json` |
| Could run with `NODE_ENV=production` | Refuses to run when `NODE_ENV=production` |

Demo credentials are unchanged and remain development-only. No new secrets were added.

**Note for existing databases:** older seed versions inserted appointments, feedback, queries and chat rows with random IDs. The first run of the new seed on such a database adds the fixed-ID rows once. After that, reruns add nothing. A database seeded only by the new script never accumulates duplicates.

## Test-database guard

`backend/test/setupTestDatabase.js` is registered as a Jest `setupFiles` entry. It runs before each test file imports the app or Prisma. It:

1. requires `TEST_DATABASE_URL`, and refuses to start if it is missing;
2. refuses any database whose name does not contain `test`, and refuses `medicore_db` explicitly;
3. sets `DATABASE_URL` to the test URL for the rest of the run.

The connection string is never printed. Only the database name appears in the refusal message.

## Reproducible checklist

```bash
# 1. a dedicated, migrated test database (never medicore_db)
export DATABASE_URL=<url of a database named *test*>
npx prisma migrate deploy

# 2. seed twice with the same anchor and compare counts
SEED_ANCHOR_DATE=2026-10-12 node prisma/seed.js
psql "$DATABASE_URL" -f ../docs/dbms/sql/seed_row_counts.sql > run1.txt
SEED_ANCHOR_DATE=2026-10-12 node prisma/seed.js
psql "$DATABASE_URL" -f ../docs/dbms/sql/seed_row_counts.sql > run2.txt
diff run1.txt run2.txt          # expect no output

# 3. integration tests through the guard
TEST_DATABASE_URL=$DATABASE_URL JWT_SECRET=<local> REFRESH_TOKEN_SECRET=<local> \
  node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand
```

`npm test` sets `NODE_ENV` with POSIX syntax, so on Windows run it from Git Bash, or call Jest directly as above.

## Verified results (2026-10-11, PostgreSQL 15.15, disposable containers)

| Check | Result | Evidence |
|---|---|---|
| Seed run 1 then run 2 (same anchor), fresh migrated DB | PASS: identical counts (12 users, 6 departments, 5 patients, 6 doctors, 32 availability, 10 appointments, 3 feedback, 3 queries, 1 conversation, 4 messages); 0 logical duplicates | `results/seed_repeatability_run.txt` |
| Seed run 3 with a different anchor | PASS: dates moved, counts unchanged | same file |
| Every seeded appointment inside the doctor's availability | PASS: 0 outside | same file |
| Atomicity: forced P2002 on appointment 505 | PASS: run failed and appointments 501–504 kept their previous dates (rolled back) | same file |
| Guard: `TEST_DATABASE_URL` unset | PASS: Jest refuses to start | `results/jest_guard_and_suites_run.txt` |
| Guard: `TEST_DATABASE_URL` → `medicore_db` | PASS: refused before any connection | same file |
| Jest suites through the guard | PASS: 3 suites, 23/23 tests | same file |
