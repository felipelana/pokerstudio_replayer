import { systemApi } from '@/lib/infrastructure/http/systemApi';

/**
 * Failures the server cannot see.
 *
 * A component that throws while rendering, or a promise nobody awaited, dies
 * inside the browser and leaves no trace on the server — and those are exactly
 * the faults a player runs into and never reports. This sends them on, under
 * three restraints, because a reporter that misbehaves is worse than none:
 *
 *  - the same message is only sent once per session, so a render loop that
 *    throws sixty times a second does not become sixty requests a second;
 *  - a session sends a limited number of reports in total, whatever happens;
 *  - a failure to report is swallowed. There is nowhere left to report it to.
 *
 * Nothing is read from the page: only the message, the stack and the path. The
 * server redacts on top of that, but the cheapest secret to protect is the one
 * that was never collected.
 */

const MAX_PER_SESSION = 10;
const seen = new Set<string>();
let sent = 0;
let installed = false;

/** The path only — a query string is where identifiers and tokens hide. */
function currentRoute(): string {
  return window.location.pathname.slice(0, 200);
}

export function reportClientError(error: unknown, context?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : undefined;
  const message = (err?.message ?? String(error ?? 'Unknown error')).slice(0, 500);
  if (!message || message === 'Unknown error') return;

  const key = `${message}@${currentRoute()}`;
  if (seen.has(key) || sent >= MAX_PER_SESSION) return;
  seen.add(key);
  sent += 1;

  void systemApi
    .reportError({
      message,
      stack: err?.stack?.slice(0, 8_000),
      route: currentRoute(),
      level: 'ERROR',
      context,
    })
    .catch(() => undefined);
}

/** Called once, at start-up. Safe to call again; it only ever installs once. */
export function installErrorReporter(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    reportClientError(event.error ?? event.message, { kind: 'error' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, { kind: 'unhandledrejection' });
  });
}
