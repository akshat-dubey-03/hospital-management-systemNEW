// src/config/database.js
// Prisma client singleton — ensures a single DB connection pool is shared
// across the entire application lifecycle.

import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
  });

if (env.isDevelopment) {
  globalForPrisma.prisma = prisma;
}
