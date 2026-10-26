// src/modules/feedback/feedback.routes.js
// Feedback and query routes. Full implementation in Phase 7.

import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { roleGuard } from '../../middleware/roleGuard.js';

const router = Router();

router.post('/', authMiddleware, roleGuard('PATIENT'), (_req, res) => {
  res.json({ success: true, message: 'Feedback module — Phase 7' });
});

export default router;
