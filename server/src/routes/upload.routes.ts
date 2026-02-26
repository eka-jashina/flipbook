import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { readFile, unlink } from 'node:fs/promises';
import { requireAuth } from '../middleware/auth.js';
import { fontUpload, soundUpload, imageUpload, bookUpload } from '../middleware/upload.js';
import { uploadFile, generateFileKey } from '../utils/storage.js';
import { AppError } from '../middleware/errorHandler.js';
import { parseBook } from '../parsers/BookParser.js';

const router = Router();
router.use(requireAuth);

router.post('/font', fontUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    const key = generateFileKey(`fonts/${req.user!.id}`, req.file.originalname);
    const result = await uploadFile(req.file.buffer, key, req.file.mimetype);
    res.json({ fileUrl: result.url });
  } catch (err) { next(err); }
});

router.post('/sound', soundUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    const key = generateFileKey(`sounds/${req.user!.id}`, req.file.originalname);
    const result = await uploadFile(req.file.buffer, key, req.file.mimetype);
    res.json({ fileUrl: result.url });
  } catch (err) { next(err); }
});

router.post('/image', imageUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    const key = generateFileKey(`images/${req.user!.id}`, req.file.originalname);
    const result = await uploadFile(req.file.buffer, key, req.file.mimetype);
    res.json({ fileUrl: result.url });
  } catch (err) { next(err); }
});

router.post('/book', bookUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    // Book uses disk storage — read buffer from temp file
    const buffer = await readFile(req.file.path);
    const parsed = await parseBook(buffer, req.file.originalname);
    res.json(parsed);
  } catch (err) { next(err); }
  finally {
    // Clean up temp file
    if (req.file?.path) await unlink(req.file.path).catch(() => {});
  }
});

export default router;
