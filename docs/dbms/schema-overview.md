# Schema overview

This document describes the **current** MediCore relational schema. It is derived from `backend/prisma/schema.prisma` and `backend/prisma/migrations/20260830194500_appointment_workflow_foundation/migration.sql`.

This overview was **not** verified by inspecting a live PostgreSQL catalog. Features listed as “existing database constraints” are those declared in those source files.

## Design notes

- Authentication (`users`) is separated from role-specific profiles (`patients`, `doctors`) in 1:1 relationships. This supports normalization; a formal 3NF/BCNF proof should be documented separately rather than inferred from the separation alone.
- There is **no** `admins` table. Administrators are `users` rows with `"role" = 'ADMIN'`.
- Appointment **slots are not stored**. `doctor_availability` holds weekly time blocks; the application generates slot times in application code.
- `dayOfWeek` comment in Prisma: `0` = Monday … `6` = Sunday. There is **no** CHECK constraint enforcing that range.
- Times (`startTime`, `endTime`) are `VARCHAR(5)` values in `HH:MM` form. Format is **not** enforced by PostgreSQL.

## ENUM types (PostgreSQL)

Created in the foundation migration as `CREATE TYPE ... AS ENUM`.

| Type | Values |
|------|--------|
| `"Role"` | `PATIENT`, `DOCTOR`, `ADMIN` |
| `"Gender"` | `MALE`, `FEMALE`, `OTHER`, `PREFER_NOT_TO_SAY` |
| `"AppointmentStatus"` | `BOOKED`, `CONFIRMED`, `COMPLETED`, `CANCELLED_BY_PATIENT`, `CANCELLED_BY_DOCTOR`, `CANCELLED_BY_ADMIN` |
| `"QueryStatus"` | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `"MessageRole"` | `USER`, `ASSISTANT` |

UUIDs use `gen_random_uuid()` from the `pgcrypto` extension (`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`).

Prisma `@updatedAt` columns (`updatedAt`) are `TIMESTAMPTZ NOT NULL` **without** a database default. Prisma (or explicit SQL) must supply the value on insert/update.

## Relationship diagram (logical)

```
users 1 ── 0..1 patients
users 1 ── 0..1 doctors
departments 1 ── * doctors
doctors 1 ── * doctor_availability
patients 1 ── * appointments * ── 1 doctors
patients 1 ── * feedback
patients 1 ── * queries
patients 1 ── * chat_conversations 1 ── * chat_messages
```

---

## Table: `users`

**Purpose.** Central authentication for every role. Password hashes live here; clinical profile data does not.

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | `UUID` | NO | `gen_random_uuid()` |
| `email` | `VARCHAR(255)` | NO | |
| `passwordHash` | `VARCHAR(255)` | NO | |
| `role` | `"Role"` | NO | |
| `isActive` | `BOOLEAN` | NO | `true` |
| `createdAt` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` |
| `updatedAt` | `TIMESTAMPTZ` | NO | *(none in SQL)* |

- **Primary key:** `users_pkey` on `id`
- **Foreign keys:** none
- **Unique:** `users_email_key` on `email`
- **Indexes:** unique email index only
- **Relationships:** 1:0..1 `patients`; 1:0..1 `doctors`
- **ON DELETE:** deleting a user **cascades** to `patients` and `doctors` (via those tables’ FKs)

---

## Table: `patients`

**Purpose.** Patient profile extending a `users` row (1:1).

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | `UUID` | NO | `gen_random_uuid()` |
| `userId` | `UUID` | NO | |
| `firstName` | `VARCHAR(100)` | NO | |
| `lastName` | `VARCHAR(100)` | NO | |
| `dateOfBirth` | `DATE` | YES | |
| `gender` | `"Gender"` | YES | |
| `phone` | `VARCHAR(20)` | YES | |
| `address` | `TEXT` | YES | |
| `bloodGroup` | `VARCHAR(5)` | YES | |
| `createdAt` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` |
| `updatedAt` | `TIMESTAMPTZ` | NO | *(none in SQL)* |

- **Primary key:** `patients_pkey` on `id`
- **Foreign keys:** `patients_userId_fkey` → `users(id)` **ON DELETE CASCADE ON UPDATE CASCADE**
- **Unique:** `patients_userId_key` on `userId`
- **Indexes:** unique `userId`
- **Relationships:** 1:1 `users`; 1:\* `appointments`, `feedback`, `queries`, `chat_conversations`
- **ON DELETE of this row:** restricted by appointments/feedback/queries (`RESTRICT`); chat conversations **CASCADE**

---

## Table: `departments`

**Purpose.** Normalises hospital department names out of `doctors`.

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | `UUID` | NO | `gen_random_uuid()` |
| `name` | `VARCHAR(100)` | NO | |
| `description` | `TEXT` | YES | |
| `createdAt` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` |

- **Primary key:** `departments_pkey` on `id`
- **Foreign keys:** none
- **Unique:** `departments_name_key` on `name`
- **Relationships:** 1:\* `doctors`
- **ON DELETE:** doctors reference this table with **RESTRICT** (a department that still has doctors cannot be deleted)

---

## Table: `doctors`

**Purpose.** Doctor profile extending a `users` row (1:1), including department, fee, and slot length used when generating times.

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | `UUID` | NO | `gen_random_uuid()` |
| `userId` | `UUID` | NO | |
| `departmentId` | `UUID` | NO | |
| `firstName` | `VARCHAR(100)` | NO | |
| `lastName` | `VARCHAR(100)` | NO | |
| `specialization` | `VARCHAR(200)` | NO | |
| `qualification` | `VARCHAR(200)` | NO | |
| `experienceYears` | `SMALLINT` | YES | |
| `bio` | `TEXT` | YES | |
| `phone` | `VARCHAR(20)` | YES | |
| `consultationFee` | `DECIMAL(10,2)` | YES | |
| `slotDurationMinutes` | `SMALLINT` | NO | `30` |
| `isActive` | `BOOLEAN` | NO | `true` |
| `createdAt` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` |
| `updatedAt` | `TIMESTAMPTZ` | NO | *(none in SQL)* |

- **Primary key:** `doctors_pkey` on `id`
- **Foreign keys:**
  - `doctors_userId_fkey` → `users(id)` **ON DELETE CASCADE ON UPDATE CASCADE**
  - `doctors_departmentId_fkey` → `departments(id)` **ON DELETE RESTRICT ON UPDATE CASCADE**
- **Unique:** `doctors_userId_key` on `userId`
- **Relationships:** 1:1 `users`; N:1 `departments`; 1:\* `doctor_availability`; 1:\* `appointments`
- **ON DELETE of this row:** availability **CASCADE**; appointments **RESTRICT**

Prisma does not set `onDelete` on `Doctor.department`; the generated SQL is `RESTRICT`, which is the Prisma default.

---

## Table: `doctor_availability`

**Purpose.** Weekly working blocks for a doctor. Not a slot calendar.

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | `UUID` | NO | `gen_random_uuid()` |
| `doctorId` | `UUID` | NO | |
| `dayOfWeek` | `SMALLINT` | NO | |
| `startTime` | `VARCHAR(5)` | NO | |
| `endTime` | `VARCHAR(5)` | NO | |
| `isActive` | `BOOLEAN` | NO | `true` |

- **Primary key:** `doctor_availability_pkey` on `id`
- **Foreign keys:** `doctor_availability_doctorId_fkey` → `doctors(id)` **ON DELETE CASCADE ON UPDATE CASCADE**
- **Unique:** `doctor_availability_doctorId_dayOfWeek_startTime_key` on `(doctorId, dayOfWeek, startTime)`
- **Relationships:** N:1 `doctors`
- **ON DELETE:** rows removed when the doctor is deleted (CASCADE)

There is **no** unique constraint on overlapping time ranges; only identical start times on the same day are rejected.

---

## Table: `appointments`

**Purpose.** Booked encounters between a patient and a doctor.

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | `UUID` | NO | `gen_random_uuid()` |
| `patientId` | `UUID` | NO | |
| `doctorId` | `UUID` | NO | |
| `appointmentDate` | `DATE` | NO | |
| `startTime` | `VARCHAR(5)` | NO | |
| `endTime` | `VARCHAR(5)` | NO | |
| `status` | `"AppointmentStatus"` | NO | `'BOOKED'` |
| `reasonForVisit` | `TEXT` | YES | |
| `notes` | `TEXT` | YES | |
| `cancellationReason` | `TEXT` | YES | |
| `cancelledAt` | `TIMESTAMPTZ` | YES | |
| `createdAt` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` |
| `updatedAt` | `TIMESTAMPTZ` | NO | *(none in SQL)* |

- **Primary key:** `appointments_pkey` on `id`
- **Foreign keys:**
  - `appointments_patientId_fkey` → `patients(id)` **ON DELETE RESTRICT ON UPDATE CASCADE**
  - `appointments_doctorId_fkey` → `doctors(id)` **ON DELETE RESTRICT ON UPDATE CASCADE**
- **Unique (partial):** see below
- **Non-unique indexes:**
  - `appointments_patientId_idx`
  - `appointments_doctorId_idx`
  - `appointments_appointmentDate_idx`
  - `appointments_doctorId_appointmentDate_idx`
- **Relationships:** N:1 `patients`; N:1 `doctors`

### Partial unique index (double-booking)

Declared **only** in migration SQL (not as Prisma `@@unique`, because Prisma cannot express a partial unique index):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_active_doctor_slot_unique"
ON "appointments" ("doctorId", "appointmentDate", "startTime")
WHERE "status" NOT IN (
  'CANCELLED_BY_PATIENT',
  'CANCELLED_BY_DOCTOR',
  'CANCELLED_BY_ADMIN'
);
```

Two **non-cancelled** rows cannot share the same doctor, date, and start time. A cancelled row does not occupy the slot.

Prisma `onDelete` is omitted on `Appointment.patient` / `Appointment.doctor`; generated SQL is **RESTRICT**.

---

## Table: `feedback`

**Purpose.** Patient satisfaction messages for administrators.

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | `UUID` | NO | `gen_random_uuid()` |
| `patientId` | `UUID` | NO | |
| `subject` | `VARCHAR(200)` | NO | |
| `message` | `TEXT` | NO | |
| `rating` | `SMALLINT` | YES | |
| `isRead` | `BOOLEAN` | NO | `false` |
| `createdAt` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` |

- **Primary key:** `feedback_pkey` on `id`
- **Foreign keys:** `feedback_patientId_fkey` → `patients(id)` **ON DELETE RESTRICT ON UPDATE CASCADE**
- **Indexes:** `feedback_patientId_idx`
- **Relationships:** N:1 `patients`

The Prisma comment “rating 1–5” is **documentation only**. There is **no** CHECK constraint.

---

## Table: `queries`

**Purpose.** Patient support tickets, distinct from feedback; may receive an admin response.

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | `UUID` | NO | `gen_random_uuid()` |
| `patientId` | `UUID` | NO | |
| `subject` | `VARCHAR(200)` | NO | |
| `message` | `TEXT` | NO | |
| `status` | `"QueryStatus"` | NO | `'OPEN'` |
| `adminResponse` | `TEXT` | YES | |
| `respondedAt` | `TIMESTAMPTZ` | YES | |
| `createdAt` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` |
| `updatedAt` | `TIMESTAMPTZ` | NO | *(none in SQL)* |

- **Primary key:** `queries_pkey` on `id`
- **Foreign keys:** `queries_patientId_fkey` → `patients(id)` **ON DELETE RESTRICT ON UPDATE CASCADE**
- **Indexes:** `queries_patientId_idx`
- **Relationships:** N:1 `patients`

---

## Table: `chat_conversations`

**Purpose.** Container for a patient’s AI chat session. One patient may have many conversations.

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | `UUID` | NO | `gen_random_uuid()` |
| `patientId` | `UUID` | NO | |
| `title` | `VARCHAR(200)` | YES | |
| `isActive` | `BOOLEAN` | NO | `true` |
| `createdAt` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` |
| `updatedAt` | `TIMESTAMPTZ` | NO | *(none in SQL)* |

- **Primary key:** `chat_conversations_pkey` on `id`
- **Foreign keys:** `chat_conversations_patientId_fkey` → `patients(id)` **ON DELETE CASCADE ON UPDATE CASCADE**
- **Indexes:** `chat_conversations_patientId_idx`
- **Relationships:** N:1 `patients`; 1:\* `chat_messages`

---

## Table: `chat_messages`

**Purpose.** Individual USER / ASSISTANT messages inside a conversation.

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | `UUID` | NO | `gen_random_uuid()` |
| `conversationId` | `UUID` | NO | |
| `role` | `"MessageRole"` | NO | |
| `content` | `TEXT` | NO | |
| `tokenCount` | `INTEGER` | YES | |
| `createdAt` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` |

- **Primary key:** `chat_messages_pkey` on `id`
- **Foreign keys:** `chat_messages_conversationId_fkey` → `chat_conversations(id)` **ON DELETE CASCADE ON UPDATE CASCADE**
- **Indexes:** `chat_messages_conversationId_createdAt_idx` on `(conversationId, createdAt)`
- **Relationships:** N:1 `chat_conversations`

---

## Table: `appointment_status_audit` (added in Review 3)

**Purpose.** This table holds the history of appointment status changes. It is written only by the trigger `trg_appointments_status_audit` and never by the application. See `triggers.md`.

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `BIGSERIAL` | NO | PK |
| `appointmentId` | `UUID` | NO | FK → `appointments.id`, ON DELETE CASCADE |
| `oldStatus` | `"AppointmentStatus"` | NO | |
| `newStatus` | `"AppointmentStatus"` | NO | |
| `changedAt` | `TIMESTAMPTZ` | NO | default `CURRENT_TIMESTAMP` (transaction time) |
| `changedBy` | `VARCHAR(63)` | NO | `session_user` (database role, not the Express user) |

- **Indexes:** `appointment_status_audit_appointmentId_changedAt_idx` on `(appointmentId, changedAt)`
- **Relationships:** N:1 `appointments`. Modelled in Prisma as `AppointmentStatusAudit`.

The appointments indexes changed after Review 1. `appointments_patientId_idx` was replaced by `appointments_patientId_appointmentDate_startTime_idx` (see `indexing.md`).

---

## Database constraints vs application-level validation

### Confirmed as database objects (in migration SQL)

- Primary keys on every table
- Unique indexes listed above
- Foreign keys and their ON DELETE / ON UPDATE rules
- ENUM types
- Non-unique appointment/feedback/query/chat indexes
- Partial unique index `appointments_active_doctor_slot_unique`
- Column nullability and the defaults that appear in SQL (`isActive`, `slotDurationMinutes`, status enums, `createdAt`, UUID generation)

### CHECK constraints (added after Review 1)

Added by the additive migration `backend/prisma/migrations/20261011100000_dbms_integrity_checks`. They are also included at the end of `sql/01_ddl.sql`, and demonstrated in `sql/05_integrity_constraints.sql`. Prisma 5 cannot express CHECK constraints in `schema.prisma`; `prisma migrate diff` ignores them, so they cause no drift.

| Constraint | Table | Rule | Previously enforced by |
|------------|-------|------|------------------------|
| `feedback_rating_range_chk` | feedback | `rating IS NULL OR rating BETWEEN 1 AND 5` | Prisma comment only |
| `doctor_availability_day_of_week_chk` | doctor_availability | `dayOfWeek BETWEEN 0 AND 6` (0 = Monday) | Prisma comment only |
| `doctor_availability_time_format_chk` | doctor_availability | start/end match `^([01][0-9]\|2[0-3]):[0-5][0-9]$` | nothing (admin/seed writes) |
| `doctor_availability_time_order_chk` | doctor_availability | `endTime > startTime` | nothing |
| `doctors_slot_duration_positive_chk` | doctors | `slotDurationMinutes > 0` | nothing (0 would loop slot generation) |
| `doctors_experience_years_nonnegative_chk` | doctors | NULL or `>= 0` | nothing |
| `doctors_consultation_fee_nonnegative_chk` | doctors | NULL or `>= 0` | nothing |
| `appointments_time_format_chk` | appointments | start/end valid `HH:MM` | Zod `time` regex (API only) |
| `appointments_time_order_chk` | appointments | `endTime > startTime` | slot generation (API only) |

Design notes:

- **Times stay `VARCHAR(5)`.** Changing them to `TIME` would change Prisma types and every API payload. Zero-padded `HH:MM` strings sort in chronological order, so comparing them as text is correct once the format CHECK holds.
- **Considered and rejected:** "cancelled status ⇔ `cancelledAt IS NOT NULL`". The existing Jest fixture `dashboard.test.js` inserts a cancelled appointment without `cancelledAt`, so this constraint would break a passing test without a product decision.
- **Considered and deferred:** an exclusion constraint against *overlapping* appointment intervals. The partial unique index only blocks identical `(doctorId, appointmentDate, startTime)` for active rows. Overlap prevention would need `btree_gist` and `TIME` ranges, so it is documented as a known limitation.

### Application-level only (not PostgreSQL CHECKs)

These still live only in Express/Zod/Prisma **application** code:

| Rule | Where it lives |
|------|----------------|
| Email format, password complexity | Zod in `auth.schemas.js` |
| Appointment date `YYYY-MM-DD` | Zod in `appointments.schemas.js` (column type `DATE` already rejects invalid dates) |
| Booking not in the past; slot must fall inside availability | `appointments.routes.js` / `dateTime.js` |
| Status transitions (e.g. COMPLETED only from CONFIRMED) | `validateStatusTransition` in appointments routes (the `sp_cancel_appointment` procedure applies the same rule for SQL callers) |
| Patient/doctor/admin may only see their own rows | JWT + `roleGuard` + scoped Prisma queries |
| Duplicate email before insert | Application check **plus** unique index |

### Prisma vs SQL gap

The partial unique index is **present in SQL** and **absent from `schema.prisma`**. Prisma still receives unique-violation `P2002` at runtime because PostgreSQL enforces the index. Introspection/`db pull` may report drift. That is an existing design choice, not a Phase 1 change.

## Execution status

This document was written from the source files. `sql/01_ddl.sql` was executed on PostgreSQL 15.15 and the catalog was checked: 10 tables, 5 enums, 10 FKs, 24 indexes, the partial unique index predicate, and the 9 CHECK constraints. See `results/01_ddl_run.txt` and `results/05_integrity_constraints_run.txt`. The Prisma migrations were also applied with `prisma migrate deploy` to a disposable database. `prisma migrate diff` reported no difference between the migrations and `schema.prisma`.
