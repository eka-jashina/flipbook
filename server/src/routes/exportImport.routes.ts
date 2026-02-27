import { Router } from 'express';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { exportUserConfig, importUserConfig } from '../services/exportImport.service.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await exportUserConfig(req.user!.id);
    res.setHeader('Content-Disposition', 'attachment; filename="flipbook-export.json"');
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/import', express.json({ limit: '10mb' }), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await importUserConfig(req.user!.id, req.body)); } catch (err) { next(err); }
});

export default router;
