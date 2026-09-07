/**
 * A synchronous copy of where the reader is, written when the page is being
 * hidden or closed.
 *
 * Progress is saved to IndexedDB on every move, but that write is asynchronous:
 * closing the tab in the same instant can cut it off. localStorage is
 * synchronous and survives that moment, so it is used as the last word — read
 * once on the way back in, then discarded.
 */
const KEY = 'ps.lastSpot.v1';

export interface LastSpot {
  sessionId: string;
  handIndex: number;
  frameIndex: number;
  at: number;
}

export function rememberSpot(spot: Omit<LastSpot, 'at'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...spot, at: Date.now() }));
  } catch {
    // A browser that refuses storage simply relies on the IndexedDB write.
  }
}

/** Returns the spot saved for this session, and forgets it. */
export function takeSpot(sessionId: string): LastSpot | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const spot = JSON.parse(raw) as LastSpot;
    if (spot.sessionId !== sessionId) return undefined;
    localStorage.removeItem(KEY);
    return spot;
  } catch {
    return undefined;
  }
}
