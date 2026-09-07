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
});

export type Config = z.infer<typeof schema> & {
  adminEmails: string[];
  isProduction: boolean;
  /** Google sign-in is offered only when fully configured. */
  googleEnabled: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.parse(env);
  return {
    ...parsed,
    adminEmails: parsed.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    isProduction: parsed.NODE_ENV === 'production',
    googleEnabled: !!(parsed.GOOGLE_CLIENT_ID && parsed.GOOGLE_CLIENT_SECRET && parsed.GOOGLE_REDIRECT_URI),
  };
}
