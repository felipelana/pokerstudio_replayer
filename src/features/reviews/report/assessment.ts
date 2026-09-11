import {
  coverage,
  isReviewed,
  leaks,
  score,
  scoreForStars,
  type HandInput,
  type LeakCount,
} from '@pokerstudio/shared';
import { quickResult } from '@/domain/engine/replay';
import { getRepository } from '@/lib/db/repository';
import type { Hand, Review, UserTag } from '@/domain/model/types';

/**
 * The player's own reading of a session, worked out from what is already in
 * this browser: the stars, the tags and the notes written in the replayer.
 *
 * There is no second place to fill in. The star rating a reader has been giving
 * hands all along is the assessment; the shared ruler turns it into the same
 * 0 to 100 a coach writes, so the two can sit side by side without either being
 * re-entered.
 */
export interface SessionAssessment {
  score: number | null;
  scored: number;
  coverage: { reviewed: number; total: number; percent: number | null };
  leaks: LeakCount[];
  /** Hands read, whether by a star, a tag or a note. */
  reviewedHands: number;
}

/**
 * What this hand scored, whichever way it was written down. A number typed by
 * the reader wins; a review from before the 0 to 100 scale falls back to the
 * stars, read on the shared ruler.
 */
export function scoreOf(review: Review | undefined): number | undefined {
  if (!review) return undefined;
  if (typeof review.score === 'number') return review.score;
  return scoreForStars(review.rating);
}

function inputFor(hand: Hand, review: Review | undefined): HandInput {
  return {
    heroVpip: quickResult(hand).vpip,
    assessment: review
      ? {
          score: scoreOf(review),
          comment: review.notes,
          tags: review.tags,
          streetComments: review.streetNotes,
        }
      : null,
  };
}

/** Reads every hand of the session and sums up what the player said about it. */
export async function ownAssessment(hands: Hand[]): Promise<SessionAssessment> {
  const repo = getRepository();
  const rows: HandInput[] = [];
  for (const hand of hands) rows.push(inputFor(hand, await repo.getReview(hand.id)));
  const cov = coverage(rows);
  const s = score(rows);
  return {
    score: s.value,
    scored: s.scored,
    coverage: cov,
    leaks: leaks(rows),
    reviewedHands: rows.filter((row) => isReviewed(row.assessment)).length,
  };
}

/** Leak tags come back as ids; the report shows the names the reader gave them. */
export function leakLabel(tag: string, tagList: UserTag[]): string {
  return tagList.find((t) => t.id === tag)?.label ?? tag;
}
