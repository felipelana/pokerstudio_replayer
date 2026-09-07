/** Ports the use cases depend on. Adapters live in infrastructure. */

export interface Hasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface Clock {
  now(): Date;
}

export interface TokenGenerator {
  /** URL-safe random token handed to the user. */
  create(): string;
  /** One-way hash stored in the database. */
  hash(token: string): string;
}

export type EmailTemplate = 'verify-email' | 'reset-password' | 'welcome' | 'referral-invite' | 'account-blocked';

export interface EmailSender {
  /**
   * Queues or sends a message. While no provider is configured the adapter
   * writes to the outbox and returns `queued`, so signup never fails (5B.5).
   */
  send(input: { to: string; template: EmailTemplate; locale: string; payload: Record<string, unknown> }): Promise<'sent' | 'queued'>;
}

export interface Captcha {
  verify(token: string | undefined, ip?: string): Promise<boolean>;
}

export interface GeoIpResolver {
  countryFor(ip?: string): string | undefined;
}

export interface UserAgentParser {
  parse(userAgent?: string): { deviceType: string; os?: string; browser?: string; browserVersion?: string };
}

export interface TotpProvider {
  generateSecret(): string;
  keyUri(secret: string, account: string, issuer: string): string;
  /** Returns the accepted step so replays can be rejected. */
  verify(secret: string, code: string, lastUsedStep?: bigint): { valid: boolean; step?: bigint };
}

export interface PasswordBreachCheck {
  /** True when the password appears in a known breach corpus (HIBP k-anonymity). */
  isBreached(plain: string): Promise<boolean>;
}
