import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getSounds, updateSounds } from '../services/sounds.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

const updateSoundsSchema = z.object({
  pageFlip: z.string().max(500).optional(),
  bookOpen: z.string().max(500).optional(),
  bookClose: z.string().max(500).optional(),
});

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
