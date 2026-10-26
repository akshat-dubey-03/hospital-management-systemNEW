# ER diagram — final schema (Review 3)

This diagram matches `backend/prisma/schema.prisma` and the five migrations. GitHub renders the Mermaid source below directly. To edit it, paste the block into <https://mermaid.live> or any Mermaid/draw.io-compatible tool and export PNG/SVG for the report.

The Review 1 diagram (`er.jpeg`, kept outside the repository) shows ten entities. Review 3 added `APPOINTMENT_STATUS_AUDIT` (written only by the status-audit trigger, see `triggers.md`). The final review adds the three remaining ER-diagram entities — `MEDICAL_RECORDS`, `PRESCRIPTIONS` and `BILLS` — in migration `20261025100000_medical_records_bills_prescriptions`.

The eight core ER entities map to these tables: DEPARTMENT → `departments`, DOCTOR → `doctors`, DOCTOR_AVAILABILITY → `doctor_availability`, PATIENT → `patients`, APPOINTMENT → `appointments`, MEDICAL_RECORD → `medical_records`, BILL → `bills`, PRESCRIPTION → `prescriptions`. `users` holds login data for patients, doctors and admins.

```mermaid
erDiagram
    USERS ||--o| PATIENTS : "has profile (1 : 0..1)"
    USERS ||--o| DOCTORS : "has profile (1 : 0..1)"
    DEPARTMENTS ||--o{ DOCTORS : "employs (1 : N)"
    DOCTORS ||--o{ DOCTOR_AVAILABILITY : "works in (1 : N)"
    PATIENTS ||--o{ APPOINTMENTS : "books (1 : N)"
    DOCTORS ||--o{ APPOINTMENTS : "attends (1 : N)"
    APPOINTMENTS ||--o{ APPOINTMENT_STATUS_AUDIT : "status history (1 : N)"
    APPOINTMENTS ||--o| MEDICAL_RECORDS : "documented by (1 : 0..1)"
    APPOINTMENTS ||--o| BILLS : "billed by (1 : 0..1)"
    DOCTORS ||--o{ MEDICAL_RECORDS : "writes (1 : N)"
    MEDICAL_RECORDS ||--o{ PRESCRIPTIONS : "contains (1 : N)"
    PATIENTS ||--o{ FEEDBACK : "gives (1 : N)"
    PATIENTS ||--o{ QUERIES : "raises (1 : N)"
    PATIENTS ||--o{ CHAT_CONVERSATIONS : "opens (1 : N)"
    CHAT_CONVERSATIONS ||--o{ CHAT_MESSAGES : "contains (1 : N)"

    USERS {
        uuid id PK
        varchar email UK
        varchar passwordHash
        Role role
        boolean isActive
        timestamptz createdAt
        timestamptz updatedAt
    }
    PATIENTS {
        uuid id PK
        uuid userId FK,UK "on delete cascade"
        varchar firstName
        varchar lastName
        date dateOfBirth
        Gender gender
        varchar phone
        text address
        varchar bloodGroup
        timestamptz createdAt
        timestamptz updatedAt
    }
    DEPARTMENTS {
        uuid id PK
        varchar name UK
        text description
        timestamptz createdAt
    }
    DOCTORS {
        uuid id PK
        uuid userId FK,UK "on delete cascade"
        uuid departmentId FK "on delete restrict"
        varchar firstName
        varchar lastName
        varchar specialization
        varchar qualification
        smallint experienceYears "CHECK >= 0"
        text bio
        varchar phone
        decimal consultationFee "CHECK >= 0"
        smallint slotDurationMinutes "CHECK > 0"
        boolean isActive
        timestamptz createdAt
        timestamptz updatedAt
    }
    DOCTOR_AVAILABILITY {
        uuid id PK
        uuid doctorId FK "UK with dayOfWeek, startTime"
        smallint dayOfWeek "CHECK 0-6, 0=Mon"
        varchar startTime "CHECK HH:MM"
        varchar endTime "CHECK HH:MM, > start"
        boolean isActive
    }
    APPOINTMENTS {
        uuid id PK
        uuid patientId FK "on delete restrict"
        uuid doctorId FK "on delete restrict"
        date appointmentDate
        varchar startTime "CHECK HH:MM"
        varchar endTime "CHECK HH:MM, > start"
        AppointmentStatus status
        text reasonForVisit
        text notes
        text cancellationReason
        timestamptz cancelledAt
        timestamptz createdAt
        timestamptz updatedAt
    }
    APPOINTMENT_STATUS_AUDIT {
        bigint id PK
        uuid appointmentId FK "on delete cascade"
        AppointmentStatus oldStatus
        AppointmentStatus newStatus
        timestamptz changedAt
        varchar changedBy
    }
    MEDICAL_RECORDS {
        uuid id PK
        uuid appointmentId FK,UK "on delete restrict"
        uuid doctorId FK "on delete restrict; = appointment doctor (trigger)"
        text diagnosis "CHECK not blank"
        text treatmentNotes
        date recordDate
        timestamptz createdAt
        timestamptz updatedAt
    }
    PRESCRIPTIONS {
        uuid id PK
        uuid medicalRecordId FK "on delete cascade"
        varchar medicineName "CHECK not blank"
        varchar dosage "CHECK not blank"
        varchar frequency "CHECK not blank"
        varchar duration "CHECK not blank"
        timestamptz createdAt
    }
    BILLS {
        uuid id PK
        uuid appointmentId FK,UK "on delete restrict"
        decimal amount "DECIMAL(10,2), CHECK >= 0"
        date billDate
        PaymentStatus paymentStatus "PENDING / PAID / CANCELLED"
        timestamptz paidAt "set exactly when PAID (CHECK)"
        timestamptz createdAt
        timestamptz updatedAt
    }
    FEEDBACK {
        uuid id PK
        uuid patientId FK "on delete restrict"
        varchar subject
        text message
        smallint rating "CHECK 1-5 or NULL"
        boolean isRead
        timestamptz createdAt
    }
    QUERIES {
        uuid id PK
        uuid patientId FK "on delete restrict"
        varchar subject
        text message
        QueryStatus status
        text adminResponse
        timestamptz respondedAt "kept consistent by trigger"
        timestamptz createdAt
        timestamptz updatedAt
    }
    CHAT_CONVERSATIONS {
        uuid id PK
        uuid patientId FK "on delete cascade"
        varchar title
        boolean isActive
        timestamptz createdAt
        timestamptz updatedAt
    }
    CHAT_MESSAGES {
        uuid id PK
        uuid conversationId FK "on delete cascade"
        MessageRole role
        text content
        int tokenCount
        timestamptz createdAt
    }
```

## Cardinalities and delete rules

| Parent → child | Cardinality | FK | ON DELETE |
|---|---|---|---|
| users → patients | 1 : 0..1 | `patients.userId` (unique) | CASCADE |
| users → doctors | 1 : 0..1 | `doctors.userId` (unique) | CASCADE |
| departments → doctors | 1 : N | `doctors.departmentId` | RESTRICT |
| doctors → doctor_availability | 1 : N | `doctor_availability.doctorId` | CASCADE |
| patients → appointments | 1 : N | `appointments.patientId` | RESTRICT |
| doctors → appointments | 1 : N | `appointments.doctorId` | RESTRICT |
| appointments → appointment_status_audit | 1 : N | `appointment_status_audit.appointmentId` | CASCADE |
| appointments → medical_records | 1 : 0..1 | `medical_records.appointmentId` (unique) | RESTRICT |
| appointments → bills | 1 : 0..1 | `bills.appointmentId` (unique) | RESTRICT |
| doctors → medical_records | 1 : N | `medical_records.doctorId` | RESTRICT |
| medical_records → prescriptions | 1 : N | `prescriptions.medicalRecordId` | CASCADE |
| patients → feedback | 1 : N | `feedback.patientId` | RESTRICT |
| patients → queries | 1 : N | `queries.patientId` | RESTRICT |
| patients → chat_conversations | 1 : N | `chat_conversations.patientId` | CASCADE |
| chat_conversations → chat_messages | 1 : N | `chat_messages.conversationId` | CASCADE |

All foreign keys are `ON UPDATE CASCADE`.

## Constraints and indexes not visible in the diagram
- **Partial unique index** `appointments_active_doctor_slot_unique` on `(doctorId, appointmentDate, startTime)`, applied only when `status` is not a cancelled status. It blocks double-booking of active slots and lets cancelled slots be rebooked.
- **Appointment indexes:** `(patientId, appointmentDate, startTime)`, `doctorId`, `appointmentDate`, `(doctorId, appointmentDate)`. Elsewhere: `feedback.patientId`, `queries.patientId`, `chat_conversations.patientId`, `chat_messages(conversationId, createdAt)`, and `appointment_status_audit(appointmentId, changedAt)`.
- **6 enum types:** `Role`, `Gender`, `AppointmentStatus`, `QueryStatus`, `MessageRole`, `PaymentStatus`.
- **Final-review additions:** unique `medical_records.appointmentId` and `bills.appointmentId` (0..1 per appointment); indexes `medical_records.doctorId`, `prescriptions.medicalRecordId`, `bills.paymentStatus`; CHECKs `medical_records_diagnosis_not_blank_chk`, `prescriptions_fields_not_blank_chk`, `bills_amount_nonnegative_chk`, `bills_paid_at_consistent_chk`; trigger `trg_medical_records_doctor_match` (record doctor must be the appointment's doctor). Tests: `docs/dbms/tests/medical_billing_tests.sql` (16 cases).
