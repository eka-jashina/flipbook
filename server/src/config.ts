import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().min(1),

  SESSION_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32).optional(),
  SESSION_MAX_AGE: z.coerce.number().default(604800000), // 7 days
  SESSION_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  GOOGLE_CLIENT_ID: z.string().default('placeholder'),
  GOOGLE_CLIENT_SECRET: z.string().default('placeholder'),
  GOOGLE_CALLBACK_URL: z
    .string()
    .default('http://localhost:4000/api/auth/google/callback'),

  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().default('flipbook-uploads'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_FORCE_PATH_STYLE: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  S3_PUBLIC_URL: z
    .string()
    .default('http://localhost:9000/flipbook-uploads'),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  APP_URL: z.string().default('http://localhost:3000'),

  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  SENTRY_DSN: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;
  _config = envSchema.parse(process.env);
  return _config;
}

export function getConfig(): Config {
  if (!_config) return loadConfig();
  return _config;
}
