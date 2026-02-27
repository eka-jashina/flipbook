import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getReadingProgress, upsertReadingProgress } from '../services/progress.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upsertProgressSchema } from '../schemas.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ progress: await getReadingProgress(req.params.bookId as string, req.user!.id) }); } catch (err) { next(err); }
});
router.put('/', validate(upsertProgressSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await upsertReadingProgress(req.params.bookId as string, req.user!.id, req.body)); } catch (err) { next(err); }
});

export default router;
