import { NextResponse, type NextRequest } from 'next/server';

/**
 * One app, two sites.
 *
 * `pokerstudio.com.br` is the landing page and `replayer.pokerstudio.com.br` is
 * the product, and they keep the addresses they already have. The host decides
 * which of the two answers, so neither had to move to a path.
 *
 * In development there is only localhost, so `?site=1` reaches the landing and
 * anything else reaches the replayer.
 */
const LANDING_HOSTS = new Set(['pokerstudio.com.br', 'www.pokerstudio.com.br']);

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0] ?? '';
  const asked = request.nextUrl.searchParams.has('site');
  const isLanding = LANDING_HOSTS.has(host) || asked;

  if (!isLanding) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith('/site')) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/site';
  return NextResponse.rewrite(url);
}

export const config = {
  // The API, the build output and the files in public are never rewritten.
  matcher: ['/((?!api|_next|favicon.svg|manifest.webmanifest|icons).*)'],
};
