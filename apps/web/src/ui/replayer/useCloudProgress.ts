import { useEffect, useRef } from 'react';
import { reviewApi } from '@/infrastructure/http/reviewApi';
import { useAuthStore } from '@/state/authStore';

/** Ids known to exist on the server, so a local-only session never gets poked. */
let known: Set<string> | undefined;
let loading: Promise<void> | undefined;

async function loadKnown(): Promise<Set<string>> {
  if (known) return known;
  loading ??= reviewApi
    .list()
    .then((data) => {
      known = new Set(data.items.map((row) => row.id));
    })
    .catch(() => {
      known = new Set();
    })
    .finally(() => {
      loading = undefined;
    });
  await loading;
  return known ?? new Set();
}

/** Forgets the cache after a push, so a freshly saved review starts syncing. */
export function forgetKnownReviews() {
  known = undefined;
}

const DEBOUNCE_MS = 4000;

/**
 * Keeps "continue where you left off" honest: while a review that also lives on
 * the account is open, the hand the user is on is pushed up, debounced so that
 * paging quickly through hands makes one request, not thirty.
 */
export function useCloudProgress(sessionId: string | undefined, handIndex: number, handCount: number) {
  const phase = useAuthStore((s) => s.phase);
  const timer = useRef<number>();
  const lastSent = useRef(-1);

  useEffect(() => {
    if (phase !== 'authenticated' || !sessionId || handCount === 0) return;
    if (lastSent.current === handIndex) return;

    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void (async () => {
        const ids = await loadKnown();
        if (!ids.has(sessionId)) return;
        try {
          await reviewApi.progress(sessionId, {
            currentHandIndex: handIndex,
            status: handIndex >= handCount - 1 ? 'COMPLETED' : 'IN_PROGRESS',
          });
          lastSent.current = handIndex;
        } catch {
          // Progress is a convenience; losing it must never interrupt a review.
        }
      })();
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer.current);
  }, [phase, sessionId, handIndex, handCount]);
}
