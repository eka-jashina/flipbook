import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
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
    const parsed = await parseBook(req.file.buffer, req.file.originalname);
    res.json(parsed);
  } catch (err) { next(err); }
});

export default router;
