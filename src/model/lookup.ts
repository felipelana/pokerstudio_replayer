import type { Site } from './types';
import { siteNetwork } from './sites';

/** Default external lookup: SharkScope, all networks unless the room is known. */
export const DEFAULT_LOOKUP_TEMPLATE =
  'https://pt.sharkscope.com/#Player-Statistics//networks/{network}/players/{nick}';

/** A template is usable only if it can carry the nick. */
export function isValidLookupTemplate(template: string): boolean {
  return template.includes('{nick}');
}

/**
 * Fill a lookup template. The destination uses a URL fragment, so the pieces
 * are substituted textually (a URL/searchParams round-trip would drop the `#`).
 */
export function buildLookupUrl(template: string, nick: string, site?: Site): string {
  const safe = isValidLookupTemplate(template) ? template : DEFAULT_LOOKUP_TEMPLATE;
  return safe
    .replace('{network}', encodeURIComponent(siteNetwork(site)))
    .replace('{nick}', encodeURIComponent(nick.trim()));
}
