// src/index.js
// MediCore HMS — Express Application Entry Point
// Initialises middleware, registers all API routes, and starts the HTTP server.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { logger } from './utils/logger.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route modules
import authRoutes from './modules/auth/auth.routes.js';
import patientRoutes from './modules/patients/patients.routes.js';
import doctorRoutes from './modules/doctors/doctors.routes.js';
import appointmentRoutes from './modules/appointments/appointments.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import feedbackRoutes from './modules/feedback/feedback.routes.js';
import chatRoutes from './modules/chat/chat.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import departmentRoutes from './modules/departments/departments.routes.js';
import recordRoutes from './modules/records/records.routes.js';
import billRoutes from './modules/bills/bills.routes.js';

const app = express();

// ─── Security Middleware ─────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true, // Allow cookies for refresh token
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Rate Limiting ───────────────────────────────────────────
// Applies to the credential endpoints only (login/register). /refresh and /me
// run on every page load and must not exhaust the budget during normal use.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX,
  skip: (req) => !['/login', '/register'].includes(req.path),
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Body Parsing ────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Logging ─────────────────────────────────────────────────
app.use(requestLogger);

// ─── Health Check ────────────────────────────────────────────
// Also pings PostgreSQL so a running server with a dead database is visible.
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', database: 'down', timestamp: new Date().toISOString() });
  }
});

// ─── API Routes ──────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/queries', feedbackRoutes); // Shares the router; routes differentiated internally
app.use('/api/chat', chatRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/medical-records', recordRoutes);
app.use('/api/bills', billRoutes);

// ─── 404 Handler ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found.' });
});

// ─── Global Error Handler (must be last) ─────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    logger.info('Database connected.');

    app.listen(env.PORT, () => {
      logger.info(`MediCore HMS backend running on port ${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (env.NODE_ENV !== 'test') {
  start();
}

// ─── Graceful Shutdown ───────────────────────────────────────
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

export { app, start };
