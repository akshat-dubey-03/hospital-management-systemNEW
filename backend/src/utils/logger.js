// src/utils/logger.js
// Winston structured logger.
// IMPORTANT: Never log passwords, JWT tokens, API keys, or PII.

import { createLogger, format, transports } from 'winston';
import { env } from '../config/env.js';

const { combine, timestamp, printf, colorize, errors } = format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  format.json()
);

export const logger = createLogger({
  level: env.LOG_LEVEL,
  format: env.isDevelopment ? devFormat : prodFormat,
  transports: [new transports.Console()],
});
