import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import passport from 'passport';
import { getConfig } from './config.js';
import { configurePassport } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { logger } from './utils/logger.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import booksRoutes from './routes/books.routes.js';
import chaptersRoutes from './routes/chapters.routes.js';

export function createApp() {
  const config = getConfig();
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
    }),
  );

  // Rate limiting
  app.use('/api/', createRateLimiter());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

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

  // Request logging
  app.use((req, _res, next) => {
    logger.info({ method: req.method, url: req.url }, 'Request');
    next();
  });

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/books', booksRoutes);
  app.use('/api/books/:bookId/chapters', chaptersRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
