# Normalization: functional dependencies, keys and normal forms

The Review 1 report claimed 3NF as a design-level assessment. This section replaces that with the functional dependencies (FDs) that actually hold, the candidate keys, and a check against each normal form.

**Notation.** `X → Y` means every value of X determines exactly one value of Y. Each table uses a surrogate UUID `id` (BIGSERIAL for the audit table). A natural key is listed only where the schema enforces it with a UNIQUE constraint or index.

## Method
- **1NF:** every column is atomic (one value, no repeating groups or lists), and every table has a primary key.
- **2NF:** no non-prime attribute depends on *part* of a composite candidate key.
- **3NF:** for every non-trivial FD `X → A`, either X is a superkey or A is prime.
- **BCNF:** for every non-trivial FD `X → A`, X is a superkey.

## Per-table analysis

| Table | Candidate keys | Non-trivial FDs that hold | Determinants all superkeys? | Highest NF |
|---|---|---|---|---|
| users | `{id}`, `{email}` | `id → all`, `email → all` | yes | **BCNF** |
| patients | `{id}`, `{userId}` | `id → all`, `userId → all` | yes | **BCNF** |
| departments | `{id}`, `{name}` | `id → all`, `name → all` | yes | **BCNF** |
| doctors | `{id}`, `{userId}` | `id → all`, `userId → all` | yes | **BCNF** |
| doctor_availability | `{id}`, `{doctorId, dayOfWeek, startTime}` | `id → all`, `{doctorId, dayOfWeek, startTime} → endTime, isActive, id` | yes | **BCNF** |
| appointments | `{id}` | `id → all` (see the discussion below) | yes | **BCNF** |
| appointment_status_audit | `{id}` | `id → all` | yes | **BCNF** |
| feedback | `{id}` | `id → all` | yes | **BCNF** |
| queries | `{id}` | `id → all` | yes | **BCNF** |
| chat_conversations | `{id}` | `id → all` | yes | **BCNF** |
| chat_messages | `{id}` | `id → all` | yes | **BCNF** |

Every table is in 1NF: all columns are scalar, and the only multi-valued facts (availability blocks, messages, appointments) live in their own tables. 2NF holds trivially wherever the only key is a single column. For `doctor_availability`, whose composite key is `{doctorId, dayOfWeek, startTime}`, no non-prime attribute depends on part of it. A doctor's `endTime` varies by block, so `doctorId → endTime` does not hold. Because every determinant is a candidate key, each table is in BCNF, which implies 3NF.

### Attribute-closure example (doctor_availability)
F = { `id → doctorId, dayOfWeek, startTime, endTime, isActive`; `doctorId, dayOfWeek, startTime → id` }.
- `{doctorId, dayOfWeek, startTime}⁺` = { doctorId, dayOfWeek, startTime } → add `id` → add `endTime, isActive` = **all attributes**. So it is a superkey.
- No proper subset is a superkey: `{doctorId, dayOfWeek}⁺` = itself, since a doctor can have two blocks on one day (Monday 09:00–13:00 and 14:00–17:00 in the demo data). So it is a **candidate key**, enforced by `doctor_availability_doctorId_dayOfWeek_startTime_key`.

### Points that need care (good viva material)

1. **`appointments(doctorId, appointmentDate, startTime)` is *not* a candidate key** of the whole relation. A cancelled appointment and a new active booking may share those values (tests T06 and P1-3). It is unique only among *active* rows, which is why it is enforced by a **partial** unique index and not a key constraint. As a result, FDs from it are not claimed.

2. **`appointments.endTime` is not derivable.** Application code computes `endTime = startTime + doctor.slotDurationMinutes` when booking. But a doctor's slot length can change later, and earlier appointments must keep their original end time. So `{doctorId, startTime} → endTime` does **not** hold over time; `endTime` is a fact about the appointment itself. Storing it is not a normalization violation.

3. **`doctors.consultationFee` is not copied into appointments.** Reports that estimate fees multiply by the *current* fee (`vw_dbms_doctor_appointment_stats`), and the report states this as a limitation. A real billing module would store the charged amount per appointment or invoice, because that is a historical fact, not a dependency on the doctor.

4. **Status consistency fields.** `cancelledAt` and `cancellationReason` are meaningful only for cancelled statuses, and `respondedAt` only when `adminResponse` exists. These are *conditional* business rules, not FDs. They are enforced by the procedures and the `trg_queries_responded_at` trigger, not by decomposition.

5. **Why authentication is separate from profiles.** If `email` and `passwordHash` lived in both `patients` and `doctors`, a person's login data would be spread over two tables. Uniqueness of email across roles could then no longer be enforced by one constraint. Splitting `users` out gives one key (`email`) for all logins.

### An anomaly the design prevents (illustration)
Suppose `appointments` stored `departmentName` next to `doctorId`. Then `doctorId → departmentName` would be a transitive dependency (`id → doctorId → departmentName`), and the table would be only in 2NF.

- **Update anomaly:** renaming "Orthopedics" would require changing every appointment row of every orthopedic doctor. Missing one leaves inconsistent data.
- **Insertion anomaly:** a new department could not appear in reports until it had an appointment.
- **Deletion anomaly:** deleting a department's last appointment would lose its name.

The actual schema stores `departmentId` only in `doctors`, and `name` only in `departments`. The reporting view `vw_dbms_appointment_details` *derives* the department name through joins at query time, so no stored copy can drift.

## Denormalization decisions
None are stored. The only "pre-joined" structures are **views**, which store no data.
