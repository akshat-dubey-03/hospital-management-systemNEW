# Individual viva preparation (MediCore schema)

Short, schema-specific answers. Each points to where the evidence lives.

**Candidate keys.** `users`: `{id}`, `{email}`. `departments`: `{id}`, `{name}`. `patients` and `doctors`: `{id}`, `{userId}`. `doctor_availability`: `{id}` and `{doctorId, dayOfWeek, startTime}`. The others have only `{id}`. The primary key is the candidate key we chose (here, a surrogate UUID); the others become alternate keys enforced by UNIQUE.

**Functional dependencies and closure.** `{doctorId, dayOfWeek, startTime}⁺` gives all attributes of `doctor_availability`, so it is a superkey. `{doctorId, dayOfWeek}⁺` does not, because two blocks can exist on one day. So the three-column set is a minimal superkey, i.e. a candidate key (`normalization.md`).

**3NF vs BCNF.** 3NF allows `X → A` when A is prime, even if X is not a superkey. BCNF requires every determinant to be a superkey. All MediCore tables are BCNF, since their only determinants are candidate keys. Trap: `appointments(doctorId, date, startTime)` is unique only among *active* rows, so it is not a key and gives no FD. That is why a partial unique index enforces it.

**Anomalies.** If `appointments` stored `departmentName`, renaming a department would need many updates (update anomaly). A department with no appointments could not be recorded (insertion anomaly). Deleting the last appointment would lose the name (deletion anomaly). The views derive names through joins instead.

**FK ON DELETE choices.**
- `users → patients/doctors`: CASCADE. A profile cannot exist without its login.
- `patients/doctors → appointments`: RESTRICT. Medical history must not disappear silently (T05).
- `conversations → messages`: CASCADE. Messages are part of the conversation.
- `appointments → audit`: CASCADE. Appointments are never deleted by the app; CASCADE keeps the test cleanup working. The trade-off is documented in `triggers.md`.

**CHECK and NULL.** A CHECK fails only when its expression is FALSE; NULL makes it UNKNOWN, which passes. So `rating BETWEEN 1 AND 5` alone already accepts NULL. We write `rating IS NULL OR …` to make the intent explicit (T04).

**Joins / subqueries / set operations.**
- INNER keeps matches. LEFT keeps all left rows (departments without doctors, BQ-C02). FULL keeps both sides (BQ-C04).
- A correlated subquery runs per outer row (BQ-D06). EXISTS / NOT EXISTS is NULL-safe. NOT IN fails when the subquery returns NULL (BQ-D09).
- UNION removes duplicates and UNION ALL keeps them. INTERSECT / EXCEPT need union-compatible column lists (BQ-E01–E04).

**Composite index order.** Equality columns first, then range/sort columns in ORDER BY order. Only leftmost prefixes are usable: `(patientId, appointmentDate, startTime)` helps `patientId = ?`, but not `appointmentDate = ?` (5a/5b in `indexing.md`).

**EXPLAIN.** `EXPLAIN` shows estimates. `EXPLAIN ANALYZE` executes the query and adds actual rows and time; `BUFFERS` adds pages touched. Compare estimated with actual rows (95 vs 98 in our plan). A Seq Scan is correct when a large fraction of rows match (status count, 5c).

**Isolation, lost updates, deadlocks.**
- PostgreSQL's default is READ COMMITTED. Each statement sees data committed before it started.
- **Lost update:** two read-modify-write sessions overwrite each other. We prevent it with `SELECT … FOR UPDATE` in `sp_cancel_appointment` (Scenario 3: the second caller waits, then is refused).
- **Duplicate booking:** prevented by the unique index. The second inserter waits for the first transaction, then fails (Scenario 1).
- **Deadlock:** two transactions lock rows in opposite order. PostgreSQL detects it and aborts one (40P01). Avoid it by locking in a consistent order. Not demonstrated.
- SERIALIZABLE would raise 40001, and the client must retry. Not tested.

**Procedure vs function vs trigger vs cursor.**
- A **function** returns a value and is usable in SELECT. Ours are STABLE and read-only.
- A **procedure** is called with CALL and may change data. Ours are SECURITY DEFINER, which gives a controlled write path.
- A **trigger** runs automatically on table events. It suits invariants and audit, but it is hidden, so keep it small.
- A **cursor** processes rows one at a time. It is useful for huge results or per-row side effects; otherwise set-based SQL is simpler and faster (`cursors.md`).

**SQL injection and least privilege.**
- Prisma sends parameterised queries, so input never becomes SQL text.
- Our procedures use parameters, not dynamic SQL.
- Least privilege: the reporting role sees only views, the operator writes only through procedures, and PUBLIC is revoked (`security.md`). `SECURITY DEFINER` routines pin `search_path` to prevent object hijacking.

**Password hashing.** bcrypt with cost 12 (`auth.service.js`, seed). It is salted and deliberately slow, so the database never stores plaintext. A leaked `passwordHash` column still needs per-password brute force.

**Backup and recovery (not implemented: state this honestly).**
- The project has no backup job.
- What it would need: scheduled `pg_dump` (logical; per-database; restore with `pg_restore`), and/or base backups plus WAL archiving for point-in-time recovery.
- Restores must be tested regularly.
- Docker volumes (`medicore_pgdata`) alone are not a backup.
