// src/config/env.js
// Loads and validates all required environment variables at startup.
// The application will fail fast if any required variable is missing.

import 'dotenv/config';

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key, defaultValue) {
  return process.env[key] || defaultValue;
}

export const env = {
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  PORT: parseInt(optionalEnv('PORT', '5000'), 10),

  DATABASE_URL: requireEnv('DATABASE_URL'),

  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: optionalEnv('JWT_EXPIRES_IN', '15m'),
  REFRESH_TOKEN_SECRET: requireEnv('REFRESH_TOKEN_SECRET'),
  REFRESH_TOKEN_EXPIRES_IN: optionalEnv('REFRESH_TOKEN_EXPIRES_IN', '7d'),

  LLM_PROVIDER: optionalEnv('LLM_PROVIDER', 'openai'),
  OPENAI_API_KEY: optionalEnv('OPENAI_API_KEY', ''),
  OPENAI_MODEL: optionalEnv('OPENAI_MODEL', 'gpt-4o-mini'),
  ANTHROPIC_API_KEY: optionalEnv('ANTHROPIC_API_KEY', ''),
  ANTHROPIC_MODEL: optionalEnv('ANTHROPIC_MODEL', 'claude-3-haiku-20240307'),

  FRONTEND_URL: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),

  // Login/register attempts allowed per IP per 15 minutes.
  AUTH_RATE_LIMIT_MAX: parseInt(
    optionalEnv('AUTH_RATE_LIMIT_MAX', process.env.NODE_ENV === 'production' ? '20' : '100'),
    10
  ),
  LOG_LEVEL: optionalEnv('LOG_LEVEL', 'info'),

  isDevelopment: optionalEnv('NODE_ENV', 'development') === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};
