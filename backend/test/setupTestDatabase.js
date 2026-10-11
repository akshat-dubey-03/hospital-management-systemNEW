// test/setupTestDatabase.js
// Jest setupFiles entry: runs before every test file, before the app or the
// Prisma client is imported.
//
// The integration suites create and delete fixture rows, so they must never
// reach the everyday development database. This guard requires an explicit
// TEST_DATABASE_URL whose database name contains "test", then points
// DATABASE_URL at it. The connection string is never printed.

import 'dotenv/config';

const url = process.env.TEST_DATABASE_URL;

if (!url) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Jest suites delete fixture rows and must run against a dedicated test database.'
  );
}

let databaseName;
try {
  databaseName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
} catch {
  throw new Error('TEST_DATABASE_URL is not a valid connection URL.');
}

if (!/test/i.test(databaseName) || databaseName === 'medicore_db') {
  throw new Error(
    `Refusing to run tests against database "${databaseName}": the name must identify a dedicated test database (contain "test").`
  );
}

process.env.DATABASE_URL = url;
process.env.NODE_ENV = 'test';
