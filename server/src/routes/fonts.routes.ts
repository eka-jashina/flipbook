import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getReadingFonts, createReadingFont, updateReadingFont, deleteReadingFont, reorderReadingFonts } from '../services/fonts.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(requireAuth);

const createFontSchema = z.object({ fontKey: z.string().min(1).max(100), label: z.string().min(1).max(200), family: z.string().min(1).max(300), builtin: z.boolean().optional(), enabled: z.boolean().optional(), fileUrl: z.string().max(500).optional() });
const updateFontSchema = z.object({ label: z.string().min(1).max(200).optional(), family: z.string().min(1).max(300).optional(), enabled: z.boolean().optional(), fileUrl: z.string().max(500).nullable().optional() });
const reorderSchema = z.object({ fontIds: z.array(z.string().uuid()) });

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ fonts: await getReadingFonts(req.user!.id) }); } catch (err) { next(err); }
});
router.post('/', validate(createFontSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await createReadingFont(req.user!.id, req.body)); } catch (err) { next(err); }
});
router.patch('/reorder', validate(reorderSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { await reorderReadingFonts(req.user!.id, req.body.fontIds); res.json({ message: 'Fonts reordered' }); } catch (err) { next(err); }
});
router.patch('/:fontId', validate(updateFontSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await updateReadingFont(req.params.fontId as string, req.user!.id, req.body)); } catch (err) { next(err); }
});
router.delete('/:fontId', async (req: Request, res: Response, next: NextFunction) => {
  try { await deleteReadingFont(req.params.fontId as string, req.user!.id); res.status(204).send(); } catch (err) { next(err); }
});

export default router;
