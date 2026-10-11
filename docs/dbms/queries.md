# Query index

Human-readable catalogue of the Review 2 category pack and the ten complex business queries. SQL lives in:

- [sql/03_sql_queries.sql](./sql/03_sql_queries.sql)
- [sql/04_complex_queries.sql](./sql/04_complex_queries.sql)

None of these statements were executed against PostgreSQL in this phase. Result values are **unverified**.

Prerequisite data: [sql/02_dml.sql](./sql/02_dml.sql) Section A on a disposable database created from [sql/01_ddl.sql](./sql/01_ddl.sql).

## Counts

| Category | Identifiers | Count |
|----------|-------------|------:|
| A. Basic queries | BQ-A01–BQ-A08 | 8 |
| B. Aggregates | BQ-B01–BQ-B07 | 7 |
| C. Joins | BQ-C01–BQ-C07 | 7 |
| D. Subqueries | BQ-D01–BQ-D09 | 9 |
| E. Set operations | BQ-E01–BQ-E04 | 4 |
| F. Advanced functions | BQ-F01–BQ-F08 | 8 |
| G. Window functions | BQ-G01–BQ-G04 | 4 |
| **Category pack total** | | **47** |
| Complex business queries | CQ-01–CQ-10 | 10 |

---

## A. Basic queries — `03_sql_queries.sql`

| ID | Purpose |
|----|---------|
| BQ-A01 | List active doctors (SELECT / ORDER BY) |
| BQ-A02 | Pipeline appointments on or after 2026-10-01 (WHERE, IN, ORDER BY) |
| BQ-A03 | Distinct recorded blood groups |
| BQ-A04 | Appointments in August 2026 (BETWEEN) |
| BQ-A05 | Open or in-progress support tickets (IN) |
| BQ-A06 | Doctors whose qualification contains `DM` (LIKE) |
| BQ-A07 | Patients with no address (IS NULL) |
| BQ-A08 | Cancellations that stored `cancelledAt` (IS NOT NULL) |

## B. Aggregate queries — `03_sql_queries.sql`

The file comments explain **WHERE vs HAVING**: WHERE filters rows before grouping; HAVING filters groups after `COUNT`/`SUM`/….

| ID | Purpose |
|----|---------|
| BQ-B01 | Appointment counts by status (`COUNT`, `GROUP BY`) |
| BQ-B02 | Sum of estimated consultation fees for completed visits (`SUM`; not recorded revenue) |
| BQ-B03 | Feedback rating `AVG` / `MIN` / `MAX` |
| BQ-B04 | Completed visits and average current doctor fee per visit by department |
| BQ-B05 | Doctors with at least two appointments (`HAVING`) |
| BQ-B06 | WHERE + HAVING on non-cancelled load |
| BQ-B07 | Distinct patients per doctor (`COUNT DISTINCT`) |

## C. Joins — `03_sql_queries.sql`

| ID | Purpose |
|----|---------|
| BQ-C01 | Encounter list (`INNER JOIN` patients and doctors) |
| BQ-C02 | All departments including those with no doctors (`LEFT JOIN`) |
| BQ-C03 | Same pairing from the department side (`RIGHT JOIN`) |
| BQ-C04 | Feedback vs query activity by patient (`FULL OUTER JOIN`) |
| BQ-C05 | Patients sharing a blood group (`SELF JOIN`) |
| BQ-C06 | Doctor × weekday coverage vs availability (`CROSS JOIN`) |
| BQ-C07 | Chat transcript preview (messages ⋈ conversations ⋈ patients) |

## D. Subqueries — `03_sql_queries.sql`

BQ-D09 documents the **NOT IN / NULL** pitfall: a subquery that yields NULL makes `NOT IN` unknown for every comparison. The demonstrated query filters `patientId IS NOT NULL` and notes `NOT EXISTS` as the safer pattern.

| ID | Purpose |
|----|---------|
| BQ-D01 | Completed visit fee vs hospital average (scalar subquery) |
| BQ-D02 | Single highest-fee doctor (single-row subquery) |
| BQ-D03 | Patients with a completed visit (`IN`, multi-row) |
| BQ-D04 | Fees greater than any pediatric fee (`> ANY`) |
| BQ-D05 | Fees at least every dermatology fee (`>= ALL`) |
| BQ-D06 | Upcoming pipeline count per doctor (correlated subquery) |
| BQ-D07 | Patients with unread feedback (`EXISTS`) |
| BQ-D08 | Departments with no doctors (`NOT EXISTS`) |
| BQ-D09 | Patients who never booked Dr Sharma (`NOT IN`, NULL-safe) |

## E. Set operations — `03_sql_queries.sql`

| ID | Purpose |
|----|---------|
| BQ-E01 | Unique patient/source pairs from feedback or queries (`UNION`) |
| BQ-E02 | Same patient/source rows with duplicates kept (`UNION ALL`) |
| BQ-E03 | Patients in both feedback and queries (`INTERSECT`) |
| BQ-E04 | Department ids not referenced by doctors (`EXCEPT`) |

## F. Advanced functions — `03_sql_queries.sql`

| ID | Purpose |
|----|---------|
| BQ-F01 | Pipeline / done / cancelled buckets (`CASE`) |
| BQ-F02 | Phone and blood-group display defaults (`COALESCE`) |
| BQ-F03 | Empty cancellation reason to NULL (`NULLIF`) |
| BQ-F04 | Age on census date 2026-10-10 (`AGE`, `EXTRACT`) |
| BQ-F05 | Appointment month and weekday (`TO_CHAR`, `ISODOW`) |
| BQ-F06 | Email local-part and name length (`SPLIT_PART`, `UPPER`, `LENGTH`) |
| BQ-F07 | Fee, GST display, fee per year of experience (`ROUND`, `NULLIF`) |
| BQ-F08 | Combined patient label (`CONCAT`, `TRIM`) |

## G. Window functions — `03_sql_queries.sql`

| ID | Purpose |
|----|---------|
| BQ-G01 | `RANK`, `DENSE_RANK`, `ROW_NUMBER` on completed visit counts |
| BQ-G02 | Running total of completed consultation fees |
| BQ-G03 | Previous visit date per patient (`LAG`) |
| BQ-G04 | Next appointment per doctor (`LEAD`) |

---

## Complex business queries — `04_complex_queries.sql`

| ID | Business question | Construct |
|----|-------------------|-----------|
| CQ-01 | Department load: doctors, completed / pipeline / cancelled mix | 3 tables, `FILTER` aggregates |
| CQ-02 | Patient 360: last completed visit and next pipeline visit | Nested id lookups, 5 tables |
| CQ-03 | Completed-care fee totals by department and month | 3 tables, `GROUP BY` month |
| CQ-04 | Unread feedback **and** active support query, with last clinician | `INTERSECT`, nested last visit |
| CQ-05 | Active doctors with availability but no upcoming pipeline | `NOT EXISTS`, availability count |
| CQ-06 | Chat/message statistics vs appointment volume per patient (pre-aggregated to avoid fan-out) | 4 tables, `LEFT JOIN` aggregates |
| CQ-07 | Patients with non-cancelled appointments across two or more departments | 4 tables, `HAVING COUNT(DISTINCT …)` |
| CQ-08 | Cancellation share by actor (patient / doctor / admin) and department | 3 tables, `FILTER` |
| CQ-09 | Same-day doctor schedule with previous and next patient | 4 tables, `LAG` / `LEAD` |
| CQ-10 | Completed visits where current doctor fee exceeds active-doctor average, with prior visit date | Nested `AVG`, `LAG`, 4 tables |

Each CQ block in the SQL file also states expected **output structure** and an explanation of joins/filters. It does not invent executed numeric results.
