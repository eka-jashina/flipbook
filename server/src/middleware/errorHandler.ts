import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Invalid request data',
      statusCode: 400,
      details: err.errors,
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(statusCode).json({ error: 'UploadError', message: err.message, statusCode });
    return;
  }

  if (err.message?.startsWith('Invalid ') && err.message?.includes('file type')) {
    res.status(400).json({ error: 'UploadError', message: err.message, statusCode: 400 });
    return;
  }

  // Handle CSRF and other http-errors (have statusCode property)
  if ('statusCode' in err && typeof (err as any).statusCode === 'number') {
    const statusCode = (err as any).statusCode as number;
    res.status(statusCode).json({
      error: err.name || 'ForbiddenError',
      message: err.message,
      statusCode,
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');

  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
    statusCode: 500,
  });
}
