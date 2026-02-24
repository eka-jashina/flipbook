import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getGlobalSettings, updateGlobalSettings } from '../services/settings.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(requireAuth);

const updateSettingsSchema = z.object({
  fontMin: z.number().int().min(8).max(40).optional(),
  fontMax: z.number().int().min(8).max(40).optional(),
  settingsVisibility: z.object({ fontSize: z.boolean().optional(), theme: z.boolean().optional(), font: z.boolean().optional(), fullscreen: z.boolean().optional(), sound: z.boolean().optional(), ambient: z.boolean().optional() }).optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await getGlobalSettings(req.user!.id)); } catch (err) { next(err); }
});
router.patch('/', validate(updateSettingsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await updateGlobalSettings(req.user!.id, req.body)); } catch (err) { next(err); }
});

export default router;
