import { getRepository } from '@/db/repository';

/** One session that has the tag on at least one hand. */
export interface TagUse {
  sessionId: string;
  sessionName: string;
  /** Hand numbers as the room wrote them, in the order they were played. */
  hands: { id: string; number: string; position: number }[];
}

/**
 * Which reviews a leak tag is actually on.
 *
 * A tag is not a label in a list, it is a claim about hands the reader has
 * already studied. Deleting one silently would rewrite that history, so the
 * settings screen asks this first and names what it found.
 */
export async function usesOfTag(tagId: string): Promise<TagUse[]> {
  const repo = getRepository();
  const [reviews, sessions] = await Promise.all([repo.listReviews(), repo.listSessions()]);
  const tagged = new Set(reviews.filter((review) => review.tags.includes(tagId)).map((review) => review.handId));
  if (tagged.size === 0) return [];

  const uses: TagUse[] = [];
  for (const session of sessions) {
    const hits = session.handIds.map((id, index) => ({ id, index })).filter((row) => tagged.has(row.id));
    if (hits.length === 0) continue;
    const hands = await repo.getHands(hits.map((row) => row.id));
    const byId = new Map(hands.map((hand) => [hand.id, hand]));
    uses.push({
      sessionId: session.id,
      sessionName: session.name,
      hands: hits.map((row) => ({
        id: row.id,
        number: byId.get(row.id)?.handNumber ?? '',
        position: row.index + 1,
      })),
    });
  }
  return uses;
}

/**
 * Takes the tag off every hand that carries it, and returns how many hands
 * changed. The notes, the scores and everything else on those hands stay.
 */
export async function removeTagEverywhere(tagId: string): Promise<number> {
  const repo = getRepository();
  const reviews = await repo.listReviews();
  const affected = reviews.filter((review) => review.tags.includes(tagId));
  for (const review of affected) {
    await repo.saveReview({ ...review, tags: review.tags.filter((id) => id !== tagId), updatedAt: new Date() });
  }
  return affected.length;
}
