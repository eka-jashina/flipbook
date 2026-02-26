import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { z } from 'zod';
import { registerUser, formatUser } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createAuthRateLimiter } from '../middleware/rateLimit.js';
import { generateToken } from '../middleware/csrf.js';
import { getConfig } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const authLimiter = createAuthRateLimiter();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

/**
 * POST /api/auth/register — Register + auto-login
 */
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, displayName } = req.body;
      const userResponse = await registerUser(email, password, displayName);

      // Auto-login after registration — only need id for serializeUser
      const sessionUser: Express.User = {
        id: userResponse.id,
        email: userResponse.email,
        displayName: userResponse.displayName,
        avatarUrl: userResponse.avatarUrl,
        googleId: null,
        hasPassword: userResponse.hasPassword,
      };

      req.login(sessionUser, (err) => {
        if (err) {
          next(err);
          return;
        }
        res.status(201).json({ user: userResponse });
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/auth/login — Login with email + password
 */
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      'local',
      (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
        if (err) {
          next(err);
          return;
        }
        if (!user) {
          res.status(401).json({
            error: 'Unauthorized',
            message: info?.message || 'Invalid credentials',
            statusCode: 401,
          });
          return;
        }

        req.login(user, (loginErr) => {
          if (loginErr) {
            next(loginErr);
            return;
          }
          res.json({ user: formatUser(user) });
        });
      },
    )(req, res, next);
  },
);

/**
 * POST /api/auth/logout — Destroy session
 */
router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) {
      next(err);
      return;
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        next(destroyErr);
        return;
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });
});

/**
 * GET /api/auth/me — Get current authenticated user
 */
router.get(
  '/me',
  requireAuth,
  (req: Request, res: Response) => {
    res.json({ user: formatUser(req.user!) });
  },
);

/**
 * GET /api/auth/csrf-token — Get CSRF token for SPA
 */
router.get('/csrf-token', (req: Request, res: Response) => {
  const token = generateToken(req, res);
  res.json({ token });
});

/**
 * GET /api/auth/google — Redirect to Google OAuth
 */
router.get(
  '/google',
  authLimiter,
  passport.authenticate('google', { scope: ['profile', 'email'] }),
);

/**
 * GET /api/auth/google/callback — Google OAuth callback
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=google' }),
  (_req: Request, res: Response) => {
    const config = getConfig();
    res.redirect(config.APP_URL);
  },
);

export default router;
