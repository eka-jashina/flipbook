import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { registerUser, formatUser } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createAuthRateLimiter } from '../middleware/rateLimit.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { getConfig } from '../config.js';
import { registerSchema, loginSchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';

const router = Router();

const authLimiter = createAuthRateLimiter();

/**
 * POST /api/auth/register — Register + auto-login
 */
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res, next) => {
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
      created(res, { user: userResponse });
    });
  }),
);

/**
 * POST /api/auth/login — Login with email + password
 *
 * Uses Passport custom callback pattern — cannot use asyncHandler.
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
          ok(res, { user: formatUser(user) });
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
      ok(res, { message: 'Logged out successfully' });
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
    ok(res, { user: formatUser(req.user!) });
  },
);

/**
 * GET /api/auth/csrf-token — Get CSRF token for SPA
 */
router.get('/csrf-token', (req: Request, res: Response) => {
  const token = generateCsrfToken(req, res);
  ok(res, { token });
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
