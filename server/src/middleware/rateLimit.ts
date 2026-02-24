import rateLimit from 'express-rate-limit';
import { getConfig } from '../config.js';

/**
 * General rate limiter for API endpoints.
 */
export function createRateLimiter() {
  const config = getConfig();

  return rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW,
    max: config.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'TooManyRequests',
      message: 'Too many requests, please try again later',
      statusCode: 429,
    },
  });
}

/**
 * Strict rate limiter for auth endpoints (5 req/min).
 */
export function createAuthRateLimiter() {
  return rateLimit({
    windowMs: 60000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'TooManyRequests',
      message: 'Too many authentication attempts, please try again later',
      statusCode: 429,
    },
  });
}

/**
 * Rate limiter for public endpoints (30 req/min per IP).
 */
export function createPublicRateLimiter() {
  return rateLimit({
    windowMs: 60000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'TooManyRequests',
      message: 'Too many requests, please try again later',
      statusCode: 429,
    },
  });
}
