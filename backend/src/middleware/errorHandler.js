// src/middleware/errorHandler.js
// Global Express error handler.
// Must be registered LAST in the middleware chain.
// Converts all errors (operational ApiErrors + unexpected errors) to consistent JSON.

import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  // Log with appropriate level
  if (err.isOperational) {
    logger.warn(`[${req.method} ${req.path}] ${err.message}`);
  } else {
    logger.error('Unexpected error:', err);
  }

  // Handle Prisma unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists.',
      errors: [],
    });
  }

  // Handle Prisma foreign key violation (e.g. deleting a row that is still
  // referenced by appointments, bills or medical records — ON DELETE RESTRICT)
  if (err.code === 'P2003') {
    return res.status(409).json({
      success: false,
      message: 'This record is still referenced by other records and cannot be changed or deleted.',
      errors: [],
    });
  }

  // Handle Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Record not found.',
      errors: [],
    });
  }

  // Operational errors (ApiError instances)
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  // Unknown/unexpected errors — never expose internals in production
  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again later.',
    errors: [],
    ...(env.isDevelopment && { stack: err.stack }),
  });
}
