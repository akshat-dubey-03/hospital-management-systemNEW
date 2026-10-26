// src/modules/auth/auth.routes.js

import { Router } from 'express';
import { register, login, refresh, logout, me } from './auth.controller.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { validate } from '../../middleware/validate.js';
import { registerSchema, loginSchema } from './auth.schemas.js';

const router = Router();

// POST /api/auth/register — Patient self-registration
router.post('/register', validate(registerSchema), register);

// POST /api/auth/login — Login for all roles
router.post('/login', validate(loginSchema), login);

// POST /api/auth/refresh — Refresh access token using HTTP-only cookie
router.post('/refresh', refresh);

// POST /api/auth/logout — Invalidate refresh token cookie
router.post('/logout', authMiddleware, logout);

// GET /api/auth/me — Current authenticated user
router.get('/me', authMiddleware, me);

export default router;
