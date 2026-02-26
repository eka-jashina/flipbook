import type { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { getConfig } from '../config.js';

type CsrfFunctions = ReturnType<typeof doubleCsrf>;
let _csrf: CsrfFunctions | null = null;

function getCsrf(): CsrfFunctions {
  if (_csrf) return _csrf;
  const config = getConfig();
  _csrf = doubleCsrf({
    getSecret: () => config.SESSION_SECRET,
    // Use a constant identifier — the double-submit cookie pattern
    // provides CSRF protection via the HttpOnly cookie that attackers
    // cannot read, not via session binding.
    getSessionIdentifier: () => 'csrf',
    cookieName: '__csrf',
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.SESSION_SECURE,
      path: '/',
    },
    getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
  });
  return _csrf;
}

export function doubleCsrfProtection(req: Request, res: Response, next: NextFunction): void {
  getCsrf().doubleCsrfProtection(req, res, next);
}

export function generateCsrfToken(req: Request, res: Response): string {
  return getCsrf().generateCsrfToken(req, res);
}
