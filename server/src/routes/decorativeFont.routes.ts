import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getDecorativeFont, upsertDecorativeFont, deleteDecorativeFont } from '../services/decorativeFont.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upsertDecorativeFontSchema } from '../schemas.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const font = await getDecorativeFont(req.params.bookId as string, req.user!.id);
    if (!font) { res.status(204).send(); return; }
    res.json(font);
  } catch (err) { next(err); }
});

router.put('/', validate(upsertDecorativeFontSchema), async (req: Request, res: Response, next: NextFunction) => {
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
