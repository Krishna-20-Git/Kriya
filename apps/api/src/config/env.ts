import { z } from 'zod';

/**
 * Environment is validated once at startup. A missing or weak secret stops the
 * process immediately instead of failing later on the first login request.
 */
const booleanFromString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_SSL: booleanFromString.default(false),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(10).max(86_400).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),

    /** Comma-separated list of browser origins allowed to call the API with credentials. */
    WEB_ORIGIN: z.string().default('http://localhost:5173'),
    COOKIE_SECURE: booleanFromString.optional(),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    /** Number of reverse proxies in front of the API (Render/Railway = 1). Needed for correct client IPs in rate limiting. */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),

    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().min(1).default(10),
    RATE_LIMIT_LOGIN_PER_ACCOUNT_MAX: z.coerce.number().int().min(1).default(10),
    RATE_LIMIT_REGISTER_MAX: z.coerce.number().int().min(1).default(10),
    RATE_LIMIT_REFRESH_MAX: z.coerce.number().int().min(1).default(120),
    RATE_LIMIT_API_MAX: z.coerce.number().int().min(1).default(600),

    /** Local hour (on each phone's own clock) from which the "due tomorrow" reminder is sent. */
    REMINDER_HOUR: z.coerce.number().int().min(0).max(23).default(18),
    /** Run the reminder job inside the API process every 15 minutes (fine for an always-on server). */
    REMINDER_SCHEDULER: booleanFromString.default(false),
    /** Shared secret for POST /api/internal/reminders/run (external cron). Unset = endpoint disabled. */
    CRON_SECRET: z.string().min(32, 'CRON_SECRET must be at least 32 characters').optional(),
    /** Optional Expo access token, required only if "enhanced push security" is enabled for the Expo project. */
    EXPO_ACCESS_TOKEN: z.string().optional(),
  })
  .transform((env) => ({
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    WEB_ORIGINS: env.WEB_ORIGIN.split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
  }))
  .refine((env) => env.COOKIE_SAMESITE !== 'none' || env.COOKIE_SECURE, {
    message: 'COOKIE_SAMESITE=none requires COOKIE_SECURE=true (browsers reject it otherwise)',
  });

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`).join('\n');
  // Logger is not available yet (it depends on env), so print directly.
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}

export const env: Env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
