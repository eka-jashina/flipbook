import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getChapters,
  getChapterById,
  getChapterContent,
  createChapter,
  updateChapter,
  deleteChapter,
  reorderChapters,
} from '../services/chapters.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

// All chapter routes require authentication
router.use(requireAuth);

// Validation schemas
const createChapterSchema = z.object({
  title: z.string().min(1).max(500),
  htmlContent: z.string().optional(),
  filePath: z.string().max(500).optional(),
  bg: z.string().max(500).optional(),
  bgMobile: z.string().max(500).optional(),
});

const updateChapterSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  htmlContent: z.string().nullable().optional(),
  filePath: z.string().max(500).nullable().optional(),
  bg: z.string().max(500).optional(),
  bgMobile: z.string().max(500).optional(),
});

const reorderSchema = z.object({
  chapterIds: z.array(z.string().uuid()),
});

/**
 * GET /api/books/:bookId/chapters — List chapters (meta only)
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chapters = await getChapters(req.params.bookId as string, req.user!.id);
      res.json({ chapters });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/books/:bookId/chapters — Create chapter
 */
router.post(
  '/',
  validate(createChapterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chapter = await createChapter(
        req.params.bookId as string,
        req.user!.id,
        req.body,
      );
      res.status(201).json(chapter);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/books/:bookId/chapters/reorder — Reorder chapters
 */
router.patch(
  '/reorder',
  validate(reorderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await reorderChapters(
        req.params.bookId as string,
        req.user!.id,
        req.body.chapterIds,
      );
      res.json({ message: 'Chapters reordered' });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/books/:bookId/chapters/:chapterId — Get chapter details
 */
router.get(
  '/:chapterId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chapter = await getChapterById(
        req.params.bookId as string,
        req.params.chapterId as string,
        req.user!.id,
      );
      res.json(chapter);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/books/:bookId/chapters/:chapterId/content — Get chapter HTML
 */
router.get(
  '/:chapterId/content',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const html = await getChapterContent(
        req.params.bookId as string,
        req.params.chapterId as string,
        req.user!.id,
      );
      res.json({ html });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/books/:bookId/chapters/:chapterId — Update chapter
 */
router.patch(
  '/:chapterId',
  validate(updateChapterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chapter = await updateChapter(
        req.params.bookId as string,
        req.params.chapterId as string,
        req.user!.id,
        req.body,
      );
      res.json(chapter);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/books/:bookId/chapters/:chapterId — Delete chapter
 */
router.delete(
  '/:chapterId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteChapter(
        req.params.bookId as string,
        req.params.chapterId as string,
        req.user!.id,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
