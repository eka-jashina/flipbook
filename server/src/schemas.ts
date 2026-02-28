/**
 * Central Zod validation schemas.
 * Imported by route handlers and used to auto-generate Swagger spec.
 */
import { z } from 'zod';

// ── Shared constants ──────────────────────────────────────────
/** Absolute min/max bounds for font size across the entire app */
const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 72;

// ── Auth ───────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

// ── Books ──────────────────────────────────────────
export const createBookSchema = z.object({
  title: z.string().min(1).max(500),
  author: z.string().max(500).optional(),
});

export const updateBookSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  author: z.string().max(500).optional(),
  coverBgMode: z.enum(['default', 'none', 'custom']).optional(),
  coverBgCustomUrl: z.string().max(500).nullable().optional(),
});

export const reorderBooksSchema = z.object({
  bookIds: z.array(z.string().uuid()),
});

export const listBooksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ── Chapters ───────────────────────────────────────
/** Max chapter HTML size: 2 MB */
const MAX_HTML_CONTENT_LENGTH = 2 * 1024 * 1024;

export const createChapterSchema = z.object({
  title: z.string().min(1).max(500),
  htmlContent: z.string().max(MAX_HTML_CONTENT_LENGTH).optional(),
  filePath: z.string().max(500).optional(),
  bg: z.string().max(500).optional(),
  bgMobile: z.string().max(500).optional(),
});

export const updateChapterSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  htmlContent: z.string().max(MAX_HTML_CONTENT_LENGTH).nullable().optional(),
  filePath: z.string().max(500).nullable().optional(),
  bg: z.string().max(500).optional(),
  bgMobile: z.string().max(500).optional(),
});

export const reorderChaptersSchema = z.object({
  chapterIds: z.array(z.string().uuid()),
});

// ── Appearance ─────────────────────────────────────
export const updateAppearanceSchema = z.object({
  fontMin: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).optional(),
  fontMax: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).optional(),
}).refine(
  (data) => {
    if (data.fontMin !== undefined && data.fontMax !== undefined) {
      return data.fontMin <= data.fontMax;
    }
    return true;
  },
  { message: 'fontMin must be less than or equal to fontMax', path: ['fontMin'] },
);

export const updateThemeSchema = z.object({
  coverBgStart: z.string().max(20).optional(),
  coverBgEnd: z.string().max(20).optional(),
  coverText: z.string().max(20).optional(),
  coverBgImageUrl: z.string().max(500).nullable().optional(),
  pageTexture: z.string().max(20).optional(),
  customTextureUrl: z.string().max(500).nullable().optional(),
  bgPage: z.string().max(20).optional(),
  bgApp: z.string().max(20).optional(),
});

// ── Sounds ─────────────────────────────────────────
export const updateSoundsSchema = z.object({
  pageFlip: z.string().max(500).optional(),
  bookOpen: z.string().max(500).optional(),
  bookClose: z.string().max(500).optional(),
});

// ── Ambients ───────────────────────────────────────
export const createAmbientSchema = z.object({
  ambientKey: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  shortLabel: z.string().max(50).optional(),
  icon: z.string().max(20).optional(),
  fileUrl: z.string().max(500).optional(),
  visible: z.boolean().optional(),
  builtin: z.boolean().optional(),
});

export const updateAmbientSchema = z.object({
  ambientKey: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(200).optional(),
  shortLabel: z.string().max(50).nullable().optional(),
  icon: z.string().max(20).nullable().optional(),
  fileUrl: z.string().max(500).nullable().optional(),
  visible: z.boolean().optional(),
});

export const reorderAmbientsSchema = z.object({
  ambientIds: z.array(z.string().uuid()),
});

// ── Decorative Font ────────────────────────────────
export const upsertDecorativeFontSchema = z.object({
  name: z.string().min(1).max(200),
  fileUrl: z.string().min(1).max(500),
});

// ── Default Settings ───────────────────────────────
export const updateDefaultSettingsSchema = z.object({
  font: z.string().max(100).optional(),
  fontSize: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).optional(),
  theme: z.string().max(20).optional(),
  soundEnabled: z.boolean().optional(),
  soundVolume: z.number().min(0).max(1).optional(),
  ambientType: z.string().max(100).optional(),
  ambientVolume: z.number().min(0).max(1).optional(),
});

// ── Fonts (global) ─────────────────────────────────
export const createFontSchema = z.object({
  fontKey: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  family: z.string().min(1).max(300),
  builtin: z.boolean().optional(),
  enabled: z.boolean().optional(),
  fileUrl: z.string().max(500).optional(),
});

export const updateFontSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  family: z.string().min(1).max(300).optional(),
  enabled: z.boolean().optional(),
  fileUrl: z.string().max(500).nullable().optional(),
});

export const reorderFontsSchema = z.object({
  fontIds: z.array(z.string().uuid()),
});

// ── Settings (global) ──────────────────────────────
export const updateSettingsSchema = z.object({
  fontMin: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).optional(),
  fontMax: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).optional(),
  settingsVisibility: z.object({
    fontSize: z.boolean().optional(),
    theme: z.boolean().optional(),
    font: z.boolean().optional(),
    fullscreen: z.boolean().optional(),
    sound: z.boolean().optional(),
    ambient: z.boolean().optional(),
  }).optional(),
}).refine(
  (data) => {
    if (data.fontMin !== undefined && data.fontMax !== undefined) {
      return data.fontMin <= data.fontMax;
    }
    return true;
  },
  { message: 'fontMin must be less than or equal to fontMax', path: ['fontMin'] },
);

// ── Progress ───────────────────────────────────────
export const upsertProgressSchema = z.object({
  page: z.number().int().min(0),
  font: z.string().max(100),
  fontSize: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX),
  theme: z.string().max(20),
  soundEnabled: z.boolean(),
  soundVolume: z.number().min(0).max(1),
  ambientType: z.string().max(100),
  ambientVolume: z.number().min(0).max(1),
});
