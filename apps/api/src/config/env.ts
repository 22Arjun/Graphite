import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================
// Environment validation schema
// Fail fast on missing/invalid config
// ============================================================

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),
  DIRECT_URL: z.string().url('DIRECT_URL must be a valid connection string').optional(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),
  GITHUB_REDIRECT_URI: z.string().url('GITHUB_REDIRECT_URI must be a valid URL'),

  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),

  // Optional: Twitter API v2 bearer token for public profile fetching
  TWITTER_BEARER_TOKEN: z.string().optional(),

  // SMTP — email delivery (Nodemailer)
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
  FROM_EMAIL: z.string().email().default('noreply@graphite.app'),
  FROM_NAME: z.string().default('Graphite'),

  // Cloudinary — resume file storage
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),

  // Base URL used to construct public form links in outbound emails
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),

  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error(`\n❌ Environment validation failed:\n${formatted}\n`);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
