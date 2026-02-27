import multer from 'multer';
import os from 'node:os';
import { AppError } from './errorHandler.js';

// Use memory storage for small files (fonts, sounds, images)
const memoryStorage = multer.memoryStorage();

// Use disk storage for large files (books up to 50 MB) to avoid OOM
const bookDiskStorage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (_req, file, cb) => cb(null, `upload-${Date.now()}-${file.originalname}`),
});

/**
 * Font upload handler (max 400 KB, .woff2/.woff/.ttf/.otf).
 */
export const fontUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 400 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'font/woff2',
      'font/woff',
      'font/ttf',
      'font/otf',
      'application/font-woff2',
      'application/font-woff',
      'application/x-font-ttf',
      'application/x-font-opentype',
      'application/octet-stream',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Invalid font file type', 'INVALID_FILE_TYPE'));
    }
  },
});

/**
 * Sound upload handler (max 2 MB, audio files).
 */
export const soundUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Invalid audio file type', 'INVALID_FILE_TYPE'));
    }
  },
});

/**
 * Image upload handler (max 5 MB, image files).
 */
export const imageUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Invalid image file type', 'INVALID_FILE_TYPE'));
    }
  },
});

/**
 * Book upload handler (max 50 MB, document files).
 */
export const bookUpload = multer({
  storage: bookDiskStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/epub+zip',
      'application/xml',
      'text/xml',
      'application/octet-stream',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Invalid book file type', 'INVALID_FILE_TYPE'));
    }
  },
});
