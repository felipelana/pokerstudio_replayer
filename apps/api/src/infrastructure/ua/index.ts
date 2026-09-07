import { UAParser } from 'ua-parser-js';
import type { GeoIpResolver, UserAgentParser } from '../../application/ports/index.js';

/**
 * Device details are derived on the server from the User-Agent header — never
 * taken from anything the client claims about itself.
 */
export const uaParser: UserAgentParser = {
  parse(userAgent) {
    if (!userAgent) return { deviceType: 'UNKNOWN' };
    const parsed = new UAParser(userAgent).getResult();
    const type = parsed.device.type;
    const deviceType =
      type === 'mobile' ? 'MOBILE' : type === 'tablet' ? 'TABLET' : /bot|crawler|spider/i.test(userAgent) ? 'BOT' : 'DESKTOP';
    return {
      deviceType,
      os: parsed.os.name,
      browser: parsed.browser.name,
      browserVersion: parsed.browser.version,
    };
  },
};

/**
 * Offline GeoIP. Without a MaxMind database configured it resolves nothing
 * rather than calling an external service with the user's address.
 */
export function createGeoIpResolver(dbPath?: string): GeoIpResolver {
  if (!dbPath) return { countryFor: () => undefined };
  // A MaxMind reader is plugged in here when GEOIP_DB_PATH is provided.
  return { countryFor: () => undefined };
}
