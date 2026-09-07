import { api } from './http/client';
import { analyticsAllowed } from '@/ui/ConsentBanner';

export type UsageType = 'APP_OPEN' | 'HAND_IMPORT' | 'REVIEW_START' | 'REPORT_EXPORT' | 'SKIN_APPLIED';

const ANON_KEY = 'ps.anon.v1';

/** A random id kept in this browser, only once measurement was accepted. */
function anonId(): string | undefined {
  try {
    const stored = localStorage.getItem(ANON_KEY);
    if (stored) return stored;
    const fresh = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, '');
    localStorage.setItem(ANON_KEY, fresh);
    return fresh;
  } catch {
    return undefined;
  }
}

/**
 * Records one usage event. Silent in every failure mode: measurement must never
 * cost the user a working replayer, and it does nothing at all until the cookie
 * banner has been answered with "accept all".
 */
export function track(type: UsageType, extra?: { skinId?: string; meta?: Record<string, string | number | boolean> }) {
  if (!analyticsAllowed()) return;
  void api.post('/usage', { type, anonId: anonId(), ...extra }).catch(() => undefined);
}

/** Clears the anonymous id — called when consent is withdrawn. */
export function forgetAnonId() {
  try {
    localStorage.removeItem(ANON_KEY);
  } catch {
    // Nothing to do: a browser that refuses storage never had an id.
  }
}
