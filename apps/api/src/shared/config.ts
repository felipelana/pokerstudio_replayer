import { z } from 'zod';

/**
 * Typed configuration. Reading `process.env` is confined to this file, so the
 * rest of the code never touches the environment directly.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 32 bytes in hex'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  /** Review sessions one account may push to the server per day. */
  REVIEW_UPLOADS_PER_DAY: z.coerce.number().int().min(1).default(20),
  COOKIE_DOMAIN: z.string().optional(),
  ADMIN_EMAILS: z.string().default(''),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(10).optional(),
  EMAIL_FROM: z.string().default('nao-responda@pokerstudio.com.br'),
  EMAIL_FROM_NAME: z.string().default('PokerStudio Replayer'),
  EMAIL_REPLY_TO: z.string().optional(),
  EMAIL_PROVIDER_KEY: z.string().optional(),
  TURNSTILE_SECRET: z.string().optional(),
  GEOIP_DB_PATH: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  FACEBOOK_REDIRECT_URI: z.string().optional(),

  /** Sign in with Apple: the Services ID, plus the key that signs the secret. */
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  APPLE_REDIRECT_URI: z.string().optional(),
});

export type Config = z.infer<typeof schema> & {
  adminEmails: string[];
  isProduction: boolean;
  /** Each provider is offered only when it is fully configured. */
  googleEnabled: boolean;
  facebookEnabled: boolean;
  appleEnabled: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.parse(env);
  return {
    ...parsed,
    adminEmails: parsed.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    isProduction: parsed.NODE_ENV === 'production',
    googleEnabled: !!(parsed.GOOGLE_CLIENT_ID && parsed.GOOGLE_CLIENT_SECRET && parsed.GOOGLE_REDIRECT_URI),
    facebookEnabled: !!(parsed.FACEBOOK_APP_ID && parsed.FACEBOOK_APP_SECRET && parsed.FACEBOOK_REDIRECT_URI),
    appleEnabled: !!(
      parsed.APPLE_CLIENT_ID &&
      parsed.APPLE_TEAM_ID &&
      parsed.APPLE_KEY_ID &&
      parsed.APPLE_PRIVATE_KEY &&
      parsed.APPLE_REDIRECT_URI
    ),
  };
}
