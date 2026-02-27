import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getSounds, updateSounds } from '../services/sounds.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateSoundsSchema } from '../schemas.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

/**
 * GET /api/books/:bookId/sounds
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sounds = await getSounds(
        req.params.bookId as string,
        req.user!.id,
      );
      res.json(sounds);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/books/:bookId/sounds
 */
router.patch(
  '/',
  validate(updateSoundsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sounds = await updateSounds(
        req.params.bookId as string,
        req.user!.id,
        req.body,
      );
      res.json(sounds);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
