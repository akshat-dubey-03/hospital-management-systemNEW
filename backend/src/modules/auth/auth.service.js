// src/modules/auth/auth.service.js
// All authentication business logic.
// Handles: registration, login, token generation, refresh, logout.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

const SALT_ROUNDS = 12;

/**
 * Registers a new patient account.
 * @param {{ email, password, firstName, lastName }} data
 */
export async function registerPatient(data) {
  const { email, password, firstName, lastName } = data;

  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user + patient profile in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, role: 'PATIENT' },
    });

    const patient = await tx.patient.create({
      data: { userId: user.id, firstName, lastName },
    });

    return { user, patient };
  });

  return sanitizeUser(result.user, result.patient);
}

/**
 * Authenticates any user (Patient, Doctor, Admin).
 * @param {{ email, password }} credentials
 * @returns {{ accessToken, refreshToken, user }}
 */
export async function login(credentials) {
  const { email, password, role } = credentials;

  const user = await prisma.user.findUnique({ where: { email } });

  // Use constant-time comparison to prevent timing attacks
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  const requestedRole = role?.toUpperCase();
  if (requestedRole && user.role !== requestedRole) {
    const friendlyRoleNames = {
      PATIENT: 'patients',
      DOCTOR: 'doctors',
      ADMIN: 'administrators',
    };
    throw ApiError.forbidden(`This login is for ${friendlyRoleNames[requestedRole] || 'this role'} only.`);
  }

  if (!user.isActive) {
    throw ApiError.unauthorized('Your account has been deactivated. Please contact support.');
  }

  // Load role-specific profile for the response
  let profile = null;
  if (user.role === 'PATIENT') {
    profile = await prisma.patient.findUnique({ where: { userId: user.id } });
  } else if (user.role === 'DOCTOR') {
    profile = await prisma.doctor.findUnique({
      where: { userId: user.id },
      include: { department: true },
    });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(user, profile),
  };
}

/**
 * Refreshes the access token using a valid refresh token.
 * @param {string} refreshToken
 */
export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw ApiError.unauthorized('No refresh token provided.');
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token. Please log in again.');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('User not found or deactivated.');
  }

  const newAccessToken = generateAccessToken(user);
  return { accessToken: newAccessToken };
}

/**
 * Returns the currently authenticated user's profile.
 * @param {string} userId
 */
export async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      patient: true,
      doctor: { include: { department: true } },
    },
  });

  if (!user) throw ApiError.notFound('User not found.');

  const profile = user.patient || user.doctor || null;
  return sanitizeUser(user, profile);
}

// ─── Private Helpers ─────────────────────────────────────────

function generateAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function generateRefreshToken(user) {
  return jwt.sign({ sub: user.id }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
  });
}

/**
 * Returns a safe user object — no passwordHash, no internal DB fields.
 */
function sanitizeUser(user, profile) {
  const base = {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };

  if (!profile) return base;

  if (user.role === 'PATIENT') {
    return {
      ...base,
      firstName: profile.firstName,
      lastName: profile.lastName,
      patientId: profile.id,
    };
  }

  if (user.role === 'DOCTOR') {
    return {
      ...base,
      firstName: profile.firstName,
      lastName: profile.lastName,
      doctorId: profile.id,
      department: profile.department?.name,
      specialization: profile.specialization,
    };
  }

  return base;
}
