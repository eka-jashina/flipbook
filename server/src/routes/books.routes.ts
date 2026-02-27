import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
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
import { validate, validateQuery } from '../middleware/validate.js';
import { createBookSchema, updateBookSchema, reorderBooksSchema, listBooksQuerySchema } from '../schemas.js';

const router = Router();

// All book routes require authentication
router.use(requireAuth);

/**
 * GET /api/books — List user's books
 */
router.get(
  '/',
  validateQuery(listBooksQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, offset } = req.query as { limit?: number; offset?: number };
      const result = await getUserBooks(req.user!.id, { limit, offset });
      res.json(result);
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
  validate(reorderBooksSchema),
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
