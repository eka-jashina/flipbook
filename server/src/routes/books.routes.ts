import { Router } from 'express';
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
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';

const router = Router();

// All book routes require authentication
router.use(requireAuth);

/**
 * GET /api/books — List user's books
 */
router.get(
  '/',
  validateQuery(listBooksQuerySchema),
  asyncHandler(async (req, res) => {
    const { limit, offset } = req.query as { limit?: number; offset?: number };
    const result = await getUserBooks(req.user!.id, { limit, offset });
    ok(res, result);
  }),
);

/**
 * POST /api/books — Create a new book
 */
router.post(
  '/',
  validate(createBookSchema),
  asyncHandler(async (req, res) => {
    const book = await createBook(req.user!.id, req.body);
    created(res, book);
  }),
);

/**
 * PATCH /api/books/reorder — Reorder books
 */
router.patch(
  '/reorder',
  validate(reorderBooksSchema),
  asyncHandler(async (req, res) => {
    await reorderBooks(req.user!.id, req.body.bookIds);
    ok(res, { message: 'Books reordered' });
  }),
);

/**
 * GET /api/books/:bookId — Get book details
 */
router.get(
  '/:bookId',
  requireBookOwnership,
  asyncHandler(async (req, res) => {
    const book = await getBookById(req.params.bookId as string, req.user!.id);
    ok(res, book);
  }),
);

/**
 * PATCH /api/books/:bookId — Update book
 */
router.patch(
  '/:bookId',
  requireBookOwnership,
  validate(updateBookSchema),
  asyncHandler(async (req, res) => {
    const book = await updateBook(
      req.params.bookId as string,
      req.user!.id,
      req.body,
    );
    ok(res, book);
  }),
);

/**
 * DELETE /api/books/:bookId — Delete book
 */
router.delete(
  '/:bookId',
  requireBookOwnership,
  asyncHandler(async (req, res) => {
    await deleteBook(req.params.bookId as string, req.user!.id);
    res.status(204).send();
  }),
);

export default router;
