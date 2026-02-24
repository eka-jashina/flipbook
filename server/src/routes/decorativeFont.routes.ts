import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDecorativeFont, upsertDecorativeFont, deleteDecorativeFont } from '../services/decorativeFont.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const upsertSchema = z.object({
  name: z.string().min(1).max(200),
  fileUrl: z.string().min(1).max(500),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const font = await getDecorativeFont(req.params.bookId as string, req.user!.id);
    if (!font) { res.status(204).send(); return; }
    res.json(font);
  } catch (err) { next(err); }
});

router.put('/', validate(upsertSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const font = await upsertDecorativeFont(req.params.bookId as string, req.user!.id, req.body);
    res.json(font);
  } catch (err) { next(err); }
});

router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteDecorativeFont(req.params.bookId as string, req.user!.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
