import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Status codes worth logging at warn level for security monitoring */
const WARN_STATUS_CODES = new Set([401, 403, 429]);

function logClientError(req: Request, statusCode: number, message: string): void {
  if (WARN_STATUS_CODES.has(statusCode)) {
    logger.warn(
      { statusCode, method: req.method, url: req.originalUrl, ip: req.ip },
      `Client error: ${message}`,
    );
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.id as string | undefined;

  if (err instanceof AppError) {
    logClientError(req, err.statusCode, err.message);
    res.status(err.statusCode).json({
      error: err.code || err.name,
      message: err.message,
      statusCode: err.statusCode,
      ...(err.details !== undefined && { details: err.details }),
      ...(requestId && { requestId }),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Invalid request data',
      statusCode: 400,
      details: err.errors,
      ...(requestId && { requestId }),
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(statusCode).json({
      error: 'UploadError',
      message: err.message,
      statusCode,
      ...(requestId && { requestId }),
    });
    return;
  }

  // Handle CSRF and other http-errors (have statusCode property)
  if ('statusCode' in err && typeof (err as any).statusCode === 'number') {
    const statusCode = (err as any).statusCode as number;
    logClientError(req, statusCode, err.message);
    res.status(statusCode).json({
      error: err.name || 'ForbiddenError',
      message: err.message,
      statusCode,
      ...(requestId && { requestId }),
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');

  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
    statusCode: 500,
    ...(requestId && { requestId }),
  });
}
