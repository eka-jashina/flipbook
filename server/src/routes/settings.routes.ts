import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getGlobalSettings, updateGlobalSettings } from '../services/settings.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateSettingsSchema } from '../schemas.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await getGlobalSettings(req.user!.id)); } catch (err) { next(err); }
});
router.patch('/', validate(updateSettingsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await updateGlobalSettings(req.user!.id, req.body)); } catch (err) { next(err); }
});

export default router;
