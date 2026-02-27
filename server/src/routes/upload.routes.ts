import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { fontUpload, soundUpload, imageUpload, bookUpload } from '../middleware/upload.js';
import { uploadUserFile, uploadAndParseBook } from '../services/upload.service.js';

const router = Router();
router.use(requireAuth);

router.post('/font', fontUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await uploadUserFile(req.file, req.user!.id, 'fonts'));
  } catch (err) { next(err); }
});

router.post('/sound', soundUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await uploadUserFile(req.file, req.user!.id, 'sounds'));
  } catch (err) { next(err); }
});

router.post('/image', imageUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await uploadUserFile(req.file, req.user!.id, 'images'));
  } catch (err) { next(err); }
});

router.post('/book', bookUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await uploadAndParseBook(req.file));
  } catch (err) { next(err); }
});

export default router;
