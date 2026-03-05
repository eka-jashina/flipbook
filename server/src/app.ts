import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import passport from 'passport';
import pinoHttp from 'pino-http';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { getConfig } from './config.js';
import { configurePassport } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { doubleCsrfProtection } from './middleware/csrf.js';
import { requireBookOwnership } from './middleware/bookOwnership.js';
import { requireAuth } from './middleware/auth.js';
import { logger } from './utils/logger.js';
import { getPrisma } from './utils/prisma.js';
import { getS3Client } from './utils/storage.js';
import { swaggerSpec, swaggerHtml } from './swagger.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import booksRoutes from './routes/books.routes.js';
import chaptersRoutes from './routes/chapters.routes.js';
import appearanceRoutes from './routes/appearance.routes.js';
import soundsRoutes from './routes/sounds.routes.js';
import ambientsRoutes from './routes/ambients.routes.js';
import decorativeFontRoutes from './routes/decorativeFont.routes.js';
import progressRoutes from './routes/progress.routes.js';
import readingSessionsRoutes from './routes/readingSessions.routes.js';
import fontsRoutes from './routes/fonts.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import defaultSettingsRoutes from './routes/defaultSettings.routes.js';
import exportImportRoutes from './routes/exportImport.routes.js';
import profileRoutes from './routes/profile.routes.js';
import publicRoutes from './routes/public.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const config = getConfig();
  const app = express();

  // Trust first proxy (Nginx / cloud LB)
  app.set('trust proxy', 1);

  // Security headers (allow iframe embedding for /embed/* routes)
  // CSP must allow S3_PUBLIC_URL for uploaded images/sounds,
  // Google Fonts for custom typography, and blob:/data: for local processing
  const s3Origin = config.S3_PUBLIC_URL
    ? new URL(config.S3_PUBLIC_URL).origin
    : null;
  const imgSrc = ["'self'", 'data:', 'blob:'];
  const mediaSrc = ["'self'", 'data:'];
  if (s3Origin) {
    imgSrc.push(s3Origin);
    mediaSrc.push(s3Origin);
  }

  app.use(helmet({
    frameguard: false,
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': imgSrc,
        'media-src': mediaSrc,
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'frame-ancestors': ["'self'", '*'],
      },
    },
  }));

  // CORS (supports multiple comma-separated origins)
  const corsOrigins = config.CORS_ORIGIN.includes(',')
    ? config.CORS_ORIGIN.split(',').map((o) => o.trim())
    : config.CORS_ORIGIN;
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  // Backward-compat: redirect /api/... → /api/v1/...
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    // Skip paths that already contain /v1/ or are meta-endpoints (health, docs)
    if (req.path.startsWith('/v1/') || req.path === '/health' || req.path.startsWith('/docs')) {
      return next();
    }
    // Redirect with 308 (preserves method & body) for versioned clients
    const newUrl = `/api/v1${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;
    res.redirect(308, newUrl);
  });

  // Rate limiting
  app.use('/api/', createRateLimiter());

  // Body & cookie parsing (256kb default; import route overrides to 10mb)
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Session store (PostgreSQL)
  const PgSession = connectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        conString: config.DATABASE_URL,
        createTableIfMissing: true,
        tableName: 'session',
      }),
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: config.SESSION_MAX_AGE,
        httpOnly: true,
        secure: config.SESSION_SECURE,
        sameSite: 'lax',
      },
    }),
  );

  // Passport authentication
  app.use(passport.initialize());
  app.use(passport.session());
  configurePassport();

  // CSRF protection (double-submit cookie pattern)
  app.use(doubleCsrfProtection);

  // Request ID + structured request logging via pino-http
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.id = randomUUID();
    next();
  });

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as Request).id as string,
      autoLogging: {
        ignore: (req) => (req as Request).url === '/api/health',
      },
    }),
  );

  // Health check with DB + S3 verification (unversioned — always at /api/health)
  app.get('/api/health', async (_req: Request, res: Response) => {
    const checks: Record<string, string> = {};
    let status = 'ok';

    // Database check
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch (err) {
      logger.warn({ err }, 'Health check: database unreachable');
      checks.database = 'error';
      status = 'degraded';
    }

    // S3 storage check
    try {
      await getS3Client().send(
        new HeadBucketCommand({ Bucket: config.S3_BUCKET }),
      );
      checks.storage = 'ok';
    } catch (err) {
      logger.warn({ err, bucket: config.S3_BUCKET }, 'Health check: S3 unreachable');
      checks.storage = 'error';
      status = 'degraded';
    }

    const httpStatus = status === 'ok' ? 200 : 503;
    res.status(httpStatus).json({
      status,
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  // Swagger / OpenAPI documentation
  app.get('/api/docs/spec.json', (_req: Request, res: Response) => {
    res.json(swaggerSpec);
  });
  app.get('/api/docs', (_req: Request, res: Response) => {
    res.type('html').send(swaggerHtml);
  });

  // Routes (API v1)
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/profile', profileRoutes);
  app.use('/api/v1/public', publicRoutes);
  app.use('/api/v1/books', booksRoutes);

  // Progress & reading sessions: any authenticated user can track (no ownership required)
  app.use('/api/v1/books/:bookId/progress', progressRoutes);
  app.use('/api/v1/books/:bookId/reading-sessions', readingSessionsRoutes);

  // Book sub-resource routes — unified ownership check via middleware
  app.use('/api/v1/books/:bookId', requireAuth, requireBookOwnership);
  app.use('/api/v1/books/:bookId/chapters', chaptersRoutes);
  app.use('/api/v1/books/:bookId/appearance', appearanceRoutes);
  app.use('/api/v1/books/:bookId/sounds', soundsRoutes);
  app.use('/api/v1/books/:bookId/ambients', ambientsRoutes);
  app.use('/api/v1/books/:bookId/decorative-font', decorativeFontRoutes);
  app.use('/api/v1/books/:bookId/default-settings', defaultSettingsRoutes);

  app.use('/api/v1/fonts', fontsRoutes);
  app.use('/api/v1/settings', settingsRoutes);
  app.use('/api/v1/upload', uploadRoutes);
  app.use('/api/v1', exportImportRoutes);

  // 404 handler for unmatched API routes — prevents leaking SPA HTML for API paths
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'NotFound',
      message: 'API endpoint not found',
      statusCode: 404,
    });
  });

  // Serve pre-built client in production
  if (config.NODE_ENV === 'production') {
    const clientDist = process.env.CLIENT_DIST_PATH
      ? path.resolve(process.env.CLIENT_DIST_PATH)
      : path.resolve(__dirname, '../../dist');
    app.use(express.static(clientDist));

    // SPA fallback — skip API routes (let them 404 via errorHandler)
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
