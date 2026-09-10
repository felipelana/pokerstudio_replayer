/**
 * Where the call to action sends people.
 *
 * The rule that matters: a visitor is never sent to the wrong environment. A
 * page served from localhost sends people to the local replayer, a page served
 * from the staging host sends them to the staging replayer, and everything
 * else — the real site — sends them to production. Because the destination is
 * read from the hostname the page is being served from, one built image is
 * correct on every host, and `NEXT_PUBLIC_REPLAYER_URL` only exists to override it.
 */

const PROD_URL = process.env.NEXT_PUBLIC_REPLAYER_URL_PROD ?? 'https://replayer.pokerstudio.com.br';
const STAGING_URL = process.env.NEXT_PUBLIC_REPLAYER_URL_STAGING ?? 'https://stage.replayer.pokerstudio.com.br';
const DEV_URL = process.env.NEXT_PUBLIC_REPLAYER_URL_DEV ?? 'http://localhost:5173';

/** Hostnames that mean "someone is developing", not "a visitor". */
function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost') ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/** The host this landing page is served from when it is the staging copy. */
function isStagingHost(hostname: string): boolean {
  return hostname === 'web.replayer.pokerstudio.com.br';
}

export function replayerUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_REPLAYER_URL;
  if (explicit) return explicit;
  if (typeof window === 'undefined') return PROD_URL;
  const { hostname } = window.location;
  if (isLocalHost(hostname)) return DEV_URL;
  if (isStagingHost(hostname)) return STAGING_URL;
  return PROD_URL;
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pokerstudio.com.br';
export const SITE_LABEL = 'pokerstudio.com.br';

/** Section ids, in the order they appear. The nav and the scroll spy share it. */
export const SECTIONS = ['features', 'how', 'coach', 'reports', 'rooms', 'roadmap', 'faq'] as const;

export type SectionId = (typeof SECTIONS)[number];

/** Height of the fixed header, in pixels, used to offset anchor scrolling. */
export const HEADER_HEIGHT = 68;
