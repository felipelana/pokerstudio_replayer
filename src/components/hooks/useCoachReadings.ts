import { useEffect, useState } from 'react';
import { shareApi, type HandReading } from '@/lib/infrastructure/http/shareApi';
import { useAuthStore } from '@/lib/state/authStore';

/** One coach, what they wrote, and where they got to. */
export interface CoachReading {
  id: string;
  coachName: string;
  status: string;
  completedAt?: string | null;
  summary: {
    score: { value: number | null; scored: number };
    coverage: { reviewed: number; total: number; percent: number | null };
    leaks: { tag: string; hands: number; percent: number | null }[];
    reviewedHands: number;
  };
  /** What this coach said about each hand, by its index in the session. */
  byIndex: Map<number, HandReading>;
}

/**
 * Everything the coaches wrote about one review, for the player who owns it.
 *
 * It asks the server only for a review the account actually holds, and it fails
 * quietly: a session that lives in this browser alone, or a server that cannot
 * be reached, leaves the replayer exactly as it was.
 */
export function useCoachReadings(reviewId: string | undefined): CoachReading[] {
  const signedIn = useAuthStore((s) => s.phase === 'authenticated');
  const [readings, setReadings] = useState<CoachReading[]>([]);

  useEffect(() => {
    if (!reviewId || !signedIn) {
      setReadings([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const all = await shareApi.assessmentsOf(reviewId);
        const coaches = all.items.filter((item) => item.role === 'COACH');
        const detailed = await Promise.all(
          coaches.map(async (item) => {
            const detail = await shareApi.readingOf(item.id);
            const byIndex = new Map<number, HandReading>();
            for (const row of detail.rows)
              if (row.assessment) byIndex.set(row.index, row.assessment);
            return { ...item, coachName: item.coachName ?? '', byIndex };
          }),
        );
        if (alive) setReadings(detailed);
      } catch {
        if (alive) setReadings([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reviewId, signedIn]);

  return readings;
}
