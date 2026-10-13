# ER diagram — final schema (Review 3)

This diagram matches `backend/prisma/schema.prisma` and the five migrations. GitHub renders the Mermaid source below directly. To edit it, paste the block into <https://mermaid.live> or any Mermaid/draw.io-compatible tool and export PNG/SVG for the report.

The Review 1 diagram (`er.jpeg`, kept outside the repository) shows ten entities. The final schema adds one: `APPOINTMENT_STATUS_AUDIT`. That table is written only by the status-audit trigger (see `triggers.md`).

```mermaid
erDiagram
    USERS ||--o| PATIENTS : "has profile (1 : 0..1)"
    USERS ||--o| DOCTORS : "has profile (1 : 0..1)"
    DEPARTMENTS ||--o{ DOCTORS : "employs (1 : N)"
    DOCTORS ||--o{ DOCTOR_AVAILABILITY : "works in (1 : N)"
    PATIENTS ||--o{ APPOINTMENTS : "books (1 : N)"
    DOCTORS ||--o{ APPOINTMENTS : "attends (1 : N)"
    APPOINTMENTS ||--o{ APPOINTMENT_STATUS_AUDIT : "status history (1 : N)"
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
| patients → feedback | 1 : N | `feedback.patientId` | RESTRICT |
| patients → queries | 1 : N | `queries.patientId` | RESTRICT |
| patients → chat_conversations | 1 : N | `chat_conversations.patientId` | CASCADE |
| chat_conversations → chat_messages | 1 : N | `chat_messages.conversationId` | CASCADE |

All foreign keys are `ON UPDATE CASCADE`.

## Constraints and indexes not visible in the diagram
- **Partial unique index** `appointments_active_doctor_slot_unique` on `(doctorId, appointmentDate, startTime)`, applied only when `status` is not a cancelled status. It blocks double-booking of active slots and lets cancelled slots be rebooked.
- **Appointment indexes:** `(patientId, appointmentDate, startTime)`, `doctorId`, `appointmentDate`, `(doctorId, appointmentDate)`. Elsewhere: `feedback.patientId`, `queries.patientId`, `chat_conversations.patientId`, `chat_messages(conversationId, createdAt)`, and `appointment_status_audit(appointmentId, changedAt)`.
- **5 enum types:** `Role`, `Gender`, `AppointmentStatus`, `QueryStatus`, `MessageRole`.
