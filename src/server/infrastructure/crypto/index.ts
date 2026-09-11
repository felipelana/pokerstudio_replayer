import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { authenticator } from 'otplib';
import type {
  Hasher,
  TokenGenerator,
  TotpProvider,
  PasswordBreachCheck,
} from '../../application/ports/index.js';

/** Argon2id — the parameters follow the OWASP baseline. */
export const argon2Hasher: Hasher = {
  hash: (plain) => argonHash(plain, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
  verify: async (hashed, plain) => {
    try {
      return await argonVerify(hashed, plain);
    } catch {
      return false;
    }
  },
};

/**
 * Session and e-mail tokens: random 32 bytes handed to the user, SHA-256 kept
 * in the database — a database leak cannot be replayed as a session.
 */
export const tokenGenerator: TokenGenerator = {
  create: () => randomBytes(32).toString('base64url'),
  hash: (token) => createHash('sha256').update(token).digest('hex'),
};

export function constantTimeEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** AES-256-GCM for secrets at rest (TOTP seeds, e-mail provider keys). */
export function createCipher(keyHex: string) {
  const key = Buffer.from(keyHex, 'hex');
  return {
    encrypt(plain: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return [
        iv.toString('base64'),
        cipher.getAuthTag().toString('base64'),
        enc.toString('base64'),
      ].join('.');
    },
    decrypt(payload: string): string | undefined {
      const [iv, tag, data] = payload.split('.');
      if (!iv || !tag || !data) return undefined;
      try {
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
        decipher.setAuthTag(Buffer.from(tag, 'base64'));
        return Buffer.concat([
          decipher.update(Buffer.from(data, 'base64')),
          decipher.final(),
        ]).toString('utf8');
      } catch {
        return undefined;
      }
    },
  };
}

/** TOTP with a one-step window and replay protection by step number. */
export const totpProvider: TotpProvider = {
  generateSecret: () => authenticator.generateSecret(),
  keyUri: (secret, account, issuer) => authenticator.keyuri(account, issuer, secret),
  verify(secret, code, lastUsedStep) {
    authenticator.options = { window: 1 };
    if (!authenticator.check(code, secret)) return { valid: false };
    const step = BigInt(Math.floor(Date.now() / 30000));
    if (lastUsedStep !== undefined && step <= lastUsedStep) return { valid: false };
    return { valid: true, step };
  },
};

/**
 * Have I Been Pwned, k-anonymity: only the first five characters of the SHA-1
 * hash leave the server, never the password.
 */
export const hibpBreachCheck: PasswordBreachCheck = {
  async isBreached(plain) {
    try {
      const sha1 = createHash('sha1').update(plain).digest('hex').toUpperCase();
      const res = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
        headers: { 'Add-Padding': 'true' },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return false;
      const body = await res.text();
      return body.split('\n').some((line) => line.split(':')[0]?.trim() === sha1.slice(5));
    } catch {
      // The check is best-effort: an outage must not block a signup.
      return false;
    }
  },
};

/** Used in tests and offline environments. */
export const noBreachCheck: PasswordBreachCheck = { isBreached: async () => false };
