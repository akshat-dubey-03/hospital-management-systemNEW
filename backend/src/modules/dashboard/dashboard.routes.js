import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { getPatientDashboard, getDoctorDashboard } from './dashboard.service.js';

const router = Router();

router.get('/patient', authMiddleware, roleGuard('PATIENT'), async (req, res, next) => {
  try {
    const payload = await getPatientDashboard(req.user.id);
    new ApiResponse(200, payload, 'Patient dashboard loaded.').send(res);
  } catch (err) {
    next(err);
  }
});

router.get('/doctor', authMiddleware, roleGuard('DOCTOR'), async (req, res, next) => {
  try {
    const payload = await getDoctorDashboard(req.user.id);
    new ApiResponse(200, payload, 'Doctor dashboard loaded.').send(res);
  } catch (err) {
    next(err);
  }
});

export default router;
