# MediCore HMS — Final Review Runbook

How to start the system, what to demonstrate, where each feature lives, and what was actually tested.

---

## 1. Prerequisites

- Node.js ≥ 20, npm
- PostgreSQL 15+ (local install, or `docker compose up -d` from the repo root, which starts `medicore_postgres` with database `medicore_db`)

## 2. Environment variables (`backend/.env`)

Copy `env.example` to `backend/.env` **only if you do not already have one** — never overwrite a working `.env`.

| Variable | Required | Example / note |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql://<user>:<password>@localhost:5432/medicore_db` |
| `TEST_DATABASE_URL` | for `npm test` | `postgresql://<user>:<password>@localhost:5432/medicore_test` (name must contain `test`) |
| `JWT_SECRET` | yes | long random string |
| `REFRESH_TOKEN_SECRET` | yes | different long random string |
| `JWT_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` | no | `15m` / `7d` |
| `PORT` | no | `5000` (the frontend expects this) |
| `FRONTEND_URL` | no | `http://localhost:5173` — must match the Vite URL exactly for CORS + cookies |
| `AUTH_RATE_LIMIT_MAX` | no | login/register attempts per 15 min per IP; default 100 (20 when `NODE_ENV=production`) |
| `NODE_ENV`, `LOG_LEVEL` | no | `development`, `info` |

The frontend uses `VITE_API_URL` if set, otherwise `http://localhost:5000/api`.

## 3. Database: back up, migrate, seed

One new migration was added: `backend/prisma/migrations/20261025100000_medical_records_bills_prescriptions`. It is **purely additive** (new enum, 3 new tables, keys, indexes, CHECKs, 1 trigger). It does not alter or drop anything and touches no existing rows. No old migration was edited.

```bash
cd backend
npm install

# 1. Back up first (pick one)
pg_dump -Fc "postgresql://<user>:<password>@localhost:5432/medicore_db" -f medicore_db_before_final_review.dump
# docker: docker exec medicore_postgres pg_dump -U medicore_user -Fc medicore_db > medicore_db_before_final_review.dump

# 2. Check, then apply ONLY the pending migration
npx prisma validate
npx prisma migrate status          # should list 20261025100000_medical_records_bills_prescriptions as not applied
npx prisma migrate deploy          # applies pending migrations; never resets data
npx prisma generate

# 3. Same for the test database (used by npm test)
DATABASE_URL="<your TEST_DATABASE_URL>" npx prisma migrate deploy

# 4. Demo data (idempotent upserts; safe to re-run)
npm run db:seed
```

Do **not** use `prisma migrate dev`, `prisma migrate reset` or `npm run db:reset` on `medicore_db`.

Note on the seed: it upserts fixed demo rows. Re-running it re-anchors demo appointment dates to today and resets the demo appointments/bills it owns (e.g. bill for appointment …0507 back to PENDING). It never deletes other data.

Optional drift check (needs a throwaway shadow database):

```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://<user>:<password>@localhost:5432/medicore_shadow"
# expected: "No difference detected." (CHECKs/triggers/views are invisible to Prisma by design)
```

To restore the backup if ever needed: `pg_restore --clean -d <DATABASE_URL> medicore_db_before_final_review.dump`.

## 4. Run

```bash
# Terminal 1
cd backend && npm run dev          # http://localhost:5000, health: http://localhost:5000/health

# Terminal 2
cd frontend && npm install && npm run dev   # http://localhost:5173
```

`/health` returns `{"status":"ok","database":"up",…}` (HTTP 503 with `"database":"down"` if PostgreSQL is unreachable).
If Vite starts on a different port because 5173 is busy, either free the port or set `FRONTEND_URL` to that URL and restart the backend; otherwise CORS blocks the API.

## 5. Demo accounts (from `backend/prisma/seed.js`)

| Role | Login page | Email | Password |
|---|---|---|---|
| Admin | `/admin/login` | `admin@medicore.dev` | `Admin@1234` |
| Doctor | `/doctor/login` | `dr.sharma@medicore.dev` (also `dr.kapoor`, `dr.mehta`, `dr.singh`, `dr.gupta`, `dr.verma` @medicore.dev) | `Doctor@1234` |
| Patient | `/login` | `patient1@demo.com` … `patient5@demo.com` | `Patient@1234` |

Seeded clinical data: 3 completed visits (patient1 ↔ Dr. Sharma, patient2 ↔ Dr. Verma, patient5 ↔ Dr. Mehta), each with a medical record, prescriptions and a bill (two PAID, one PENDING).

## 6. Workflows to demonstrate

Every signed-in page has a top navigation bar for its role.

**Patient** (`/register`, then `/login`)
1. Register → log in → Dashboard.
2. Find Doctors: filter by department, search, open a profile (department, fee, weekly hours).
3. Book: choose a date → available slots come from `doctor_availability` minus active bookings → confirm.
4. Appointments: history + status; cancel a booked/confirmed future appointment (slot becomes free again).
5. Medical Records: diagnoses, treatment notes, prescriptions (own only).
6. Bills: amount, status, paid date (own only). Profile: edit phone, DOB, gender, blood group, address.

**Doctor** (`/doctor/login`, e.g. Dr. Sharma)
1. Dashboard → Appointments (filter Booked & confirmed / Completed / Cancelled).
2. Open an appointment → patient details → Confirm.
3. Write the medical record: diagnosis, treatment notes, one or more prescriptions → Save. Add/remove prescriptions afterwards, edit diagnosis/notes.
4. Mark completed → message "Bill generated from the consultation fee" (one bill per appointment, never duplicated).
5. Patients: own patients only, visit history with records.

**Admin** (`/admin/login`)
1. Dashboard: live totals incl. completed visits, departments, pending/paid bill counts and amounts.
2. Departments: add / rename / delete (delete refused while doctors belong to it).
3. Doctors: create login + profile + weekly hours in one transaction; edit; change hours; deactivate (login blocked, hidden from patients) / activate; delete only if no appointment history.
4. Patients: search, view appointments + bills, edit details, deactivate / activate; delete refused when history exists.
5. Appointments: filter by status/date/name; confirm, complete, cancel.
6. Bills: filter by status; mark paid / unpaid, cancel, edit amount while pending; "Completed visits without a bill" lets the admin enter an amount when the doctor has no consultation fee.

**Access control to show:** a patient opening `/admin/dashboard` is sent back to the patient dashboard; the API independently returns 401 without a token and 403 for the wrong role (see tests).

## 7. Where things are implemented

### Database
| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Models `MedicalRecord`, `Prescription`, `Bill`, enum `PaymentStatus`; relation fields on `Doctor`, `Appointment` |
| `backend/prisma/migrations/20261025100000_medical_records_bills_prescriptions/migration.sql` | Tables, unique FKs (0..1), indexes, CHECKs, doctor-match trigger |
| `backend/prisma/seed.js` | Demo records, prescriptions and bills for the 3 completed demo visits |
| `docs/dbms/tests/medical_billing_tests.sql` | 16 SQL cases for the new constraints (runs in a transaction, rolls back) |
| `docs/dbms/erd.md`, `schema-overview.md`, `DESIGN_CHANGELOG.md`, `README.md` | ERD (now 14 tables), table docs, change log entry 16 |

### Backend (`backend/src`)
| File | Change |
|---|---|
| `modules/records/records.routes.js`, `records.schemas.js` | `/api/medical-records`: list/get (patient own, doctor own), create with prescriptions (assigned doctor, CONFIRMED/COMPLETED only, one per appointment), edit, add/remove prescriptions. Admin gets 403 (clinical data) |
| `modules/bills/bills.routes.js`, `bills.service.js` | `/api/bills`: patient own / admin all, `/unbilled`, admin create (fee or explicit amount), admin update status/amount; idempotent bill generation |
| `modules/appointments/appointments.routes.js` | `GET /api/appointments/:id` (role-shaped detail); completion runs in a transaction with a conditional status update and generates the bill; responses include `medicalRecordId` and `bill` |
| `modules/departments/departments.routes.js` | `/api/departments`: list (any signed-in user), admin create/rename/delete with protection |
| `modules/admin/admin.routes.js`, `admin.schemas.js` | `/api/admin/doctors` (create in transaction, edit, hours, (de)activate, delete rules), `/api/admin/patients` (list, detail, edit, (de)activate, delete rules); all ADMIN-only |
| `modules/patients/patients.routes.js`, `patients.schemas.js` | `/api/patients/me` GET/PATCH (was a placeholder); doctor's `/api/patients` and `/api/patients/:id` (own patients only) |
| `modules/dashboard/dashboard.service.js` | Admin stats: completed visits, departments, bill counts/amounts |
| `modules/auth/auth.service.js` | Exported `hashPassword` so admin-created doctors use the same bcrypt cost |
| `middleware/errorHandler.js` | Prisma FK violation (P2003) → 409 instead of 500 |
| `index.js`, `config/env.js` | New routers; `/health` pings the DB; rate limiter now only on login/register (it previously also counted `/refresh` and `/me`, which every page load calls) with configurable `AUTH_RATE_LIMIT_MAX` |
| `utils/serialize.js`, `utils/actors.js` | Shared response shaping and profile lookup |
| `modules/records/records-billing.workflow.test.js` | 33 new integration tests |

### Frontend (`frontend/src`)
| File | Change |
|---|---|
| `components/common/AppNavbar.jsx`, `ProtectedRoute.jsx`, `index.css` | Role navigation + logout on every signed-in page (admin previously had no way to reach its pages) |
| `pages/admin/Manage{Departments,Doctors,Patients,Appointments}Page.jsx` | Were one-line placeholders; now full CRUD/management pages |
| `pages/admin/ManageBillsPage.jsx` (new), `AdminDashboard.jsx` | Billing management; billing stats on dashboard |
| `pages/patient/PatientProfilePage.jsx` | Was a placeholder; view/edit profile |
| `pages/patient/PatientRecordsPage.jsx`, `PatientBillsPage.jsx` (new) | Own records/prescriptions and bills |
| `pages/patient/MyAppointmentsPage.jsx`, `DoctorListPage.jsx`, `BookAppointmentPage.jsx` | Record/bill columns; department filter; fixed a race where a slow response for a previous date could overwrite the slots of the selected date; double-submit guards |
| `pages/doctor/DoctorAppointmentDetailPage.jsx` (new), `DoctorAppointmentsPage.jsx`, `PatientSearchPage.jsx` | Appointment detail with record + prescriptions editor; filters; patients page (was a placeholder) |
| `services/*.service.js`, `utils/apiError.js`, `utils/date.js`, `StatusBadge.jsx`, `api.js` | API clients, error/field-error extraction, money formatting, payment badges, role-aware redirect on expired session |
| `pages/public/LandingPage.jsx`, `index.html`, `FeedbackPage.jsx`, `FeedbackQueriesPage.jsx` | Removed claims of an AI assistant; feedback pages (unlinked) state they are not part of this release |

## 8. Tests actually executed

Environment: PostgreSQL 16.15, Node 22, Chromium (Playwright), run on 2026-10-25 against a freshly migrated and seeded `medicore_db` and `medicore_test`.

| Check | Result |
|---|---|
| `npx prisma validate`, `npx prisma format --check` | valid / formatted |
| All 7 migrations applied in order to empty databases (SQL executed with `psql --single-transaction`) | OK; row counts unchanged by the new migration |
| Seed run twice | idempotent (3 records, 4 prescriptions, 3 bills, 10 appointments after both runs) |
| `docs/dbms/tests/medical_billing_tests.sql` | **16/16 PASS** (unique 0..1, trigger, CHECKs, enum, RESTRICT, CASCADE) |
| `npm test` (4 suites) | **56/56 PASS** — 23 existing + 33 new (records, prescriptions, billing idempotency, fee-less billing, admin CRUD, transactions, 401/403 checks, data scoping) |
| `npm run build` (frontend) | OK |
| Browser walkthrough (Playwright, real servers, 37 steps) | **37/37 PASS**: registration/login/validation, role redirects, profile, discovery + filter, booking, cancellation, doctor confirm → record + 2 prescriptions → add/remove → complete → bill, doctor patients page, patient record/bill visibility, admin departments/doctors/hours/(de)activation/delete rules, patients edit + delete refusal, appointments filter + confirm, bill paid, patient sees Paid, session survives reload |
| Browser console / API errors during walkthrough | No page errors. Only 4xx were the deliberate negative tests (wrong password, invalid phone, delete dept with doctors, delete patient with history) and the expected 401 from `/auth/refresh` before login |
| Phone width (390 px) | No horizontal page scroll; tables scroll inside their frame |

**Limitation of my test environment (please re-run locally):** the Prisma engine download host was blocked in the sandbox, so `prisma migrate status/deploy` and the native query engine could not run there. The migration SQL was applied with `psql` instead, and the app/tests ran on Prisma's official WASM engine with the `pg` driver adapter (sandbox only; no project code or dependency was changed for this). Before the review, run on your machine: `npx prisma migrate status`, `npx prisma migrate deploy`, `npx prisma generate`, `npm test`, `npm run build`.

## 9. Known issues and out-of-scope items

- **ER diagram image:** no diagram file was attached with the brief; the three new entities follow the attributes listed in the brief (record ID, appointment ID, doctor ID, diagnosis, treatment notes, record date; bill ID, appointment ID, amount, bill date, payment status; prescription ID, record ID, medicine, dosage, frequency, duration). Compare against your diagram's attribute names before the review.
- **Times are UTC wall-clock** (existing design): "is this slot in the past" compares `HH:MM` as UTC, so for same-day bookings in IST a slot can stay bookable up to 5½ h after its local time. Future dates are unaffected.
- **Completion before the visit time** is allowed (existing rule), which keeps the demo possible at any time of day.
- Admins see bills and contact details but deliberately **not** diagnoses/prescriptions (403); only the patient and the authoring doctor see them.
- AI chatbot, feedback and support queries are **not** part of this build. Their API stubs remain but are not linked anywhere in the UI.
- The landing page loads Google Fonts; offline it falls back to system fonts.
