// src/modules/chat/chat.routes.js
// Chat/AI chatbot routes. Full implementation in Phase 6.

import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { roleGuard } from '../../middleware/roleGuard.js';

const router = Router();

router.get('/conversations', authMiddleware, roleGuard('PATIENT'), (_req, res) => {
  res.json({ success: true, message: 'Chat module — Phase 6', data: { conversations: [] } });
});

export default router;
