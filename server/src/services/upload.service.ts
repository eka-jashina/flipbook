import { readFile, unlink } from 'node:fs/promises';
import { uploadFile, generateFileKey } from '../utils/storage.js';
import { AppError } from '../middleware/errorHandler.js';
import { parseBook } from '../parsers/BookParser.js';
import { logger } from '../utils/logger.js';
import type { UploadResponse } from '../types/api.js';

/**
 * Upload a file to S3 under the given category folder.
 */
export async function uploadUserFile(
  file: Express.Multer.File | undefined,
  userId: string,
  category: 'fonts' | 'sounds' | 'images',
): Promise<UploadResponse> {
  if (!file) throw new AppError(400, 'No file uploaded');
  const key = generateFileKey(`${category}/${userId}`, file.originalname);
  const result = await uploadFile(file.buffer, key, file.mimetype);
  return { fileUrl: result.url };
}

/**
 * Upload a book file, parse it, and return parsed chapters.
 * Uses disk storage — reads buffer from temp file and cleans up afterwards.
 */
export async function uploadAndParseBook(
  file: Express.Multer.File | undefined,
): Promise<unknown> {
  if (!file) throw new AppError(400, 'No file uploaded');
  try {
    const buffer = await readFile(file.path);
    return await parseBook(buffer, file.originalname);
  } finally {
    if (file.path) await unlink(file.path).catch((err) => {
      logger.warn({ err, path: file.path }, 'Failed to delete temp upload file');
    });
  }
}
