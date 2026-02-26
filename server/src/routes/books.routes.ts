import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getUserBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  reorderBooks,
} from '../services/books.service.js';
import { requireAuth } from '../middleware/auth.js';
import { requireBookOwnership } from '../middleware/bookOwnership.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// All book routes require authentication
router.use(requireAuth);

// Validation schemas
const createBookSchema = z.object({
  title: z.string().min(1).max(500),
  author: z.string().max(500).optional(),
});

const updateBookSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  author: z.string().max(500).optional(),
  coverBgMode: z.enum(['default', 'none', 'custom']).optional(),
  coverBgCustomUrl: z.string().max(500).nullable().optional(),
});

const reorderSchema = z.object({
  bookIds: z.array(z.string().uuid()),
});

/**
 * GET /api/books — List user's books
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const books = await getUserBooks(req.user!.id);
      res.json({ books });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/books — Create a new book
 */
router.post(
  '/',
  validate(createBookSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const book = await createBook(req.user!.id, req.body);
      res.status(201).json(book);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/books/reorder — Reorder books
 */
router.patch(
  '/reorder',
  validate(reorderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await reorderBooks(req.user!.id, req.body.bookIds);
      res.json({ message: 'Books reordered' });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/books/:bookId — Get book details
 */
router.get(
  '/:bookId',
  requireBookOwnership,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const book = await getBookById(req.params.bookId as string, req.user!.id);
      res.json(book);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/books/:bookId — Update book
 */
router.patch(
  '/:bookId',
  requireBookOwnership,
  validate(updateBookSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const book = await updateBook(
        req.params.bookId as string,
        req.user!.id,
        req.body,
      );
      res.json(book);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/books/:bookId — Delete book
 */
router.delete(
  '/:bookId',
  requireBookOwnership,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteBook(req.params.bookId as string, req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
