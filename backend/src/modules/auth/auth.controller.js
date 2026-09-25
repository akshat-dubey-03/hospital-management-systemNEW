// src/modules/auth/auth.controller.js
// Handles HTTP layer for authentication endpoints.
// Delegates all business logic to auth.service.js.

import * as authService from './auth.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { env } from '../../config/env.js';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

export async function register(req, res, next) {
  try {
    const user = await authService.registerPatient(req.body);
    new ApiResponse(201, { user }, 'Account created successfully.').send(res);
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { accessToken, refreshToken, user } = await authService.login(req.body);

    // Set refresh token as HTTP-only cookie (never accessible from JS)
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

    new ApiResponse(200, { accessToken, user }, 'Login successful.').send(res);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies.refreshToken;
    const { accessToken } = await authService.refreshAccessToken(refreshToken);
    new ApiResponse(200, { accessToken }, 'Token refreshed.').send(res);
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);
    new ApiResponse(200, null, 'Logged out successfully.').send(res);
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    new ApiResponse(200, { user }).send(res);
  } catch (err) {
    next(err);
  }
}
