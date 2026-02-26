import { doubleCsrf } from 'csrf-csrf';
import { getConfig } from '../config.js';

const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => getConfig().SESSION_SECRET,
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: getConfig().SESSION_SECURE,
    path: '/',
  },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
});

export { doubleCsrfProtection, generateToken };
