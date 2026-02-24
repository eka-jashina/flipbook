import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getAppearance,
  updateAppearance,
  updateThemeAppearance,
} from '../services/appearance.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

const updateAppearanceSchema = z.object({
  fontMin: z.number().int().min(8).max(40).optional(),
  fontMax: z.number().int().min(8).max(40).optional(),
});

const updateThemeSchema = z.object({
  coverBgStart: z.string().max(20).optional(),
  coverBgEnd: z.string().max(20).optional(),
  coverText: z.string().max(20).optional(),
  coverBgImageUrl: z.string().max(500).nullable().optional(),
  pageTexture: z.string().max(20).optional(),
  customTextureUrl: z.string().max(500).nullable().optional(),
  bgPage: z.string().max(20).optional(),
  bgApp: z.string().max(20).optional(),
});

/**
 * GET /api/books/:bookId/appearance
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appearance = await getAppearance(
        req.params.bookId as string,
        req.user!.id,
      );
      res.json(appearance);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/books/:bookId/appearance
 */
router.patch(
  '/',
  validate(updateAppearanceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appearance = await updateAppearance(
        req.params.bookId as string,
        req.user!.id,
        req.body,
      );
      res.json(appearance);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/books/:bookId/appearance/:theme
 */
router.patch(
  '/:theme',
  validate(updateThemeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theme = req.params.theme as string;
      if (theme !== 'light' && theme !== 'dark') {
        res.status(400).json({ error: 'Theme must be "light" or "dark"' });
        return;
      }
      const appearance = await updateThemeAppearance(
        req.params.bookId as string,
        req.user!.id,
        theme,
        req.body,
      );
      res.json(appearance);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
