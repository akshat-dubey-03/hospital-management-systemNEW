// src/middleware/roleGuard.js
// Authorization middleware factory.
// Usage: roleGuard('ADMIN') or roleGuard('PATIENT', 'DOCTOR')
// Must be used AFTER authMiddleware (requires req.user to be set).

import { ApiError } from '../utils/ApiError.js';

/**
 * Returns middleware that restricts access to users with one of the specified roles.
 * @param {...string} allowedRoles - One or more role strings from the Role enum.
 * @returns {import('express').RequestHandler}
 */
export function roleGuard(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Required role: ${allowedRoles.join(' or ')}.`
        )
      );
    }

    next();
  };
}
