import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getAmbients,
  createAmbient,
  updateAmbient,
  deleteAmbient,
  reorderAmbients,
} from '../services/ambients.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

const createAmbientSchema = z.object({
  ambientKey: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  shortLabel: z.string().max(50).optional(),
  icon: z.string().max(20).optional(),
  fileUrl: z.string().max(500).optional(),
  visible: z.boolean().optional(),
  builtin: z.boolean().optional(),
});

const updateAmbientSchema = z.object({
  ambientKey: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(200).optional(),
  shortLabel: z.string().max(50).nullable().optional(),
  icon: z.string().max(20).nullable().optional(),
  fileUrl: z.string().max(500).nullable().optional(),
  visible: z.boolean().optional(),
});

const reorderSchema = z.object({
  ambientIds: z.array(z.string().uuid()),
});

/**
 * GET /api/books/:bookId/ambients
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ambients = await getAmbients(
        req.params.bookId as string,
        req.user!.id,
      );
      res.json({ ambients });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/books/:bookId/ambients
 */
router.post(
  '/',
  validate(createAmbientSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ambient = await createAmbient(
        req.params.bookId as string,
        req.user!.id,
        req.body,
      );
      res.status(201).json(ambient);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/books/:bookId/ambients/reorder
 */
router.patch(
  '/reorder',
  validate(reorderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await reorderAmbients(
        req.params.bookId as string,
        req.user!.id,
        req.body.ambientIds,
      );
      res.json({ message: 'Ambients reordered' });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/books/:bookId/ambients/:ambientId
 */
router.patch(
  '/:ambientId',
  validate(updateAmbientSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ambient = await updateAmbient(
        req.params.bookId as string,
        req.params.ambientId as string,
        req.user!.id,
        req.body,
      );
      res.json(ambient);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/books/:bookId/ambients/:ambientId
 */
router.delete(
  '/:ambientId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteAmbient(
        req.params.bookId as string,
        req.params.ambientId as string,
        req.user!.id,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
