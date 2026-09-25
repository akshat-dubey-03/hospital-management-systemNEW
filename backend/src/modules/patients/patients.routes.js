// src/modules/patients/patients.routes.js
// Patient-specific routes. Full implementation in Phase 3.

import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { roleGuard } from '../../middleware/roleGuard.js';

const router = Router();

// Placeholder — implemented in Phase 3
router.get('/me', authMiddleware, roleGuard('PATIENT'), (_req, res) => {
  res.json({ success: true, message: 'Patient module — Phase 3' });
});

export default router;
