import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getDefaultSettings, updateDefaultSettings } from '../services/defaultSettings.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateDefaultSettingsSchema } from '../schemas.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

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
  validate(updateDefaultSettingsSchema),
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
