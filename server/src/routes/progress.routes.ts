import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getReadingProgress, upsertReadingProgress } from '../services/progress.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const upsertProgressSchema = z.object({
  page: z.number().int().min(0), font: z.string().max(100), fontSize: z.number().int().min(8).max(40),
  theme: z.string().max(20), soundEnabled: z.boolean(), soundVolume: z.number().min(0).max(1),
  ambientType: z.string().max(100), ambientVolume: z.number().min(0).max(1),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ progress: await getReadingProgress(req.params.bookId as string, req.user!.id) }); } catch (err) { next(err); }
});
router.put('/', validate(upsertProgressSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await upsertReadingProgress(req.params.bookId as string, req.user!.id, req.body)); } catch (err) { next(err); }
});

export default router;
