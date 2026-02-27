import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  getAmbients,
  createAmbient,
  updateAmbient,
  deleteAmbient,
  reorderAmbients,
} from '../services/ambients.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createAmbientSchema, updateAmbientSchema, reorderAmbientsSchema } from '../schemas.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

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
  validate(reorderAmbientsSchema),
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
