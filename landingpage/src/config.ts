/**
 * Where the call to action sends people.
 *
 * The rule that matters: a visitor on the real site is never sent to localhost.
 * `VITE_REPLAYER_URL` wins when it is set (that is what `.env.development`
 * does). Otherwise the destination is chosen from the hostname the page is
 * being served from, so a production bundle opened on a laptop still behaves
 * correctly, and the production domain always points at production.
 */

const PROD_URL = import.meta.env.VITE_REPLAYER_URL_PROD ?? 'https://replayer.pokerstudio.com.br';
const DEV_URL = import.meta.env.VITE_REPLAYER_URL_DEV ?? 'http://localhost:5173';

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

export function replayerUrl(): string {
  const explicit = import.meta.env.VITE_REPLAYER_URL;
  if (explicit) return explicit;
  if (typeof window === 'undefined') return PROD_URL;
  return isLocalHost(window.location.hostname) ? DEV_URL : PROD_URL;
}

export const SITE_URL = import.meta.env.VITE_SITE_URL ?? 'https://pokerstudio.com.br';
export const SITE_LABEL = 'pokerstudio.com.br';

/** Section ids, in the order they appear. The nav and the scroll spy share it. */
export const SECTIONS = ['features', 'how', 'coach', 'reports', 'rooms', 'roadmap', 'faq'] as const;

export type SectionId = (typeof SECTIONS)[number];

/** Height of the fixed header, in pixels, used to offset anchor scrolling. */
export const HEADER_HEIGHT = 68;
