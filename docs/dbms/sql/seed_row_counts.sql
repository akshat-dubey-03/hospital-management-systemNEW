-- Row counts and duplicate check used to verify that backend/prisma/seed.js is
-- repeatable: run the seed, run this, run the seed again, run this again — the
-- two outputs must be identical.
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM "users"
UNION ALL SELECT 'departments', COUNT(*) FROM "departments"
UNION ALL SELECT 'patients', COUNT(*) FROM "patients"
UNION ALL SELECT 'doctors', COUNT(*) FROM "doctors"
UNION ALL SELECT 'doctor_availability', COUNT(*) FROM "doctor_availability"
UNION ALL SELECT 'appointments', COUNT(*) FROM "appointments"
UNION ALL SELECT 'feedback', COUNT(*) FROM "feedback"
UNION ALL SELECT 'queries', COUNT(*) FROM "queries"
UNION ALL SELECT 'chat_conversations', COUNT(*) FROM "chat_conversations"
UNION ALL SELECT 'chat_messages', COUNT(*) FROM "chat_messages";

-- Logical duplicates (same business content twice) must be zero.
SELECT 'duplicate appointments' AS check_name, COUNT(*) AS duplicates FROM (
  SELECT "patientId", "doctorId", "reasonForVisit" FROM "appointments"
  GROUP BY 1, 2, 3 HAVING COUNT(*) > 1) d
UNION ALL SELECT 'duplicate feedback', COUNT(*) FROM (
  SELECT "patientId", "subject" FROM "feedback" GROUP BY 1, 2 HAVING COUNT(*) > 1) d
UNION ALL SELECT 'duplicate queries', COUNT(*) FROM (
  SELECT "patientId", "subject" FROM "queries" GROUP BY 1, 2 HAVING COUNT(*) > 1) d
UNION ALL SELECT 'duplicate chat messages', COUNT(*) FROM (
  SELECT "conversationId", "content" FROM "chat_messages" GROUP BY 1, 2 HAVING COUNT(*) > 1) d;

-- Every seeded active appointment falls inside an active availability block.
SELECT COUNT(*) AS appointments_outside_availability
FROM "appointments" a
WHERE NOT EXISTS (
  SELECT 1 FROM "doctor_availability" v
  WHERE v."doctorId" = a."doctorId" AND v."isActive"
    AND v."dayOfWeek" = EXTRACT(ISODOW FROM a."appointmentDate") - 1
    AND a."startTime" >= v."startTime" AND a."endTime" <= v."endTime");
