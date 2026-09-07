import type { Captcha } from '../../application/ports/index.js';

/**
 * Cloudflare Turnstile. With no secret configured the check passes, so a local
 * environment works without keys — production always sets the secret.
 */
export function createTurnstile(secret?: string): Captcha {
  if (!secret) return { verify: async () => true };
  return {
    async verify(token, ip) {
      if (!token) return false;
      try {
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ secret, response: token, remoteip: ip }),
          signal: AbortSignal.timeout(4000),
        });
        const body = (await res.json()) as { success?: boolean };
        return !!body.success;
      } catch {
        return false;
      }
    },
  };
}
