// src/middleware/requestLogger.js
// Logs incoming requests.
// IMPORTANT: Does not log request bodies to avoid logging credentials or PII.

import { logger } from '../utils/logger.js';

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](
      `${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
    );
  });
  next();
}
