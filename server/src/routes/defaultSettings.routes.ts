import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDefaultSettings, updateDefaultSettings } from '../services/defaultSettings.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

const updateSchema = z.object({
  font: z.string().max(100).optional(),
  fontSize: z.number().int().min(8).max(72).optional(),
  theme: z.string().max(20).optional(),
  soundEnabled: z.boolean().optional(),
  soundVolume: z.number().min(0).max(1).optional(),
  ambientType: z.string().max(100).optional(),
  ambientVolume: z.number().min(0).max(1).optional(),
});

/**
 * GET /api/books/:bookId/default-settings
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await getDefaultSettings(
        req.params.bookId as string,
        req.user!.id,
      );
      res.json(settings);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/books/:bookId/default-settings
 */
router.patch(
  '/',
  validate(updateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await updateDefaultSettings(
        req.params.bookId as string,
        req.user!.id,
        req.body,
      );
      res.json(settings);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
