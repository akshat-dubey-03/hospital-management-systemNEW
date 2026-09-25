import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { getAdminDashboardStats } from '../dashboard/dashboard.service.js';

const router = Router();

router.get('/stats', authMiddleware, roleGuard('ADMIN'), async (_req, res, next) => {
  try {
    const payload = await getAdminDashboardStats();
    new ApiResponse(200, payload, 'Admin dashboard stats loaded.').send(res);
  } catch (err) {
    next(err);
  }
});

export default router;
