import type { Hand, Review, UserTag } from '@/domain/model/types';
import { getRepository } from '@/lib/db/repository';
import { siteName } from '@/domain/model/sites';
import { ownAssessment, type SessionAssessment } from './assessment';
import type { CoachReading } from '@/components/hooks/useCoachReadings';
import type { HandReading } from '@/lib/infrastructure/http/shareApi';

export interface ReportItem {
  hand: Hand;
  review: Review;
  /** Index in the session, 1-based, so the report matches the hand list. */
  position: number;
  /** Data URL of the captured table, when the user asked for a picture. */
  image?: string;
  tags: UserTag[];
  /** What each coach said about this hand, when one did. */
  coaches: { name: string; reading: HandReading }[];
}

export interface ReportData {
  title: string;
  generatedAt: Date;
  items: ReportItem[];
  /**
   * The reader's own numbers for the whole session, not only the hands they
   * chose to print: score, coverage and the leaks that came up most.
   */
  summary: SessionAssessment;
  /** The same three numbers from each coach who read the session. */
  coaches: { name: string; summary: CoachReading['summary']; completed: boolean }[];
}

async function assetDataUrl(id?: string): Promise<string | undefined> {
  if (!id) return undefined;
  const blob = await getRepository().getAsset(id);
  if (!blob) return undefined;
  return await new Promise<string>((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(blob);
  });
}

/**
 * Collects the hands the user marked for the report (L2), with their notes,
 * tags and optional captures (L3). Everything happens in the browser.
 */
export async function buildReport(
  hands: Hand[],
  title: string,
  tagList: UserTag[],
  coachReadings: CoachReading[] = [],
): Promise<ReportData> {
  const repo = getRepository();
  const items: ReportItem[] = [];
  for (const [i, hand] of hands.entries()) {
    const review = await repo.getReview(hand.id);
    if (!review?.includeInReport) continue;
    items.push({
      hand,
      review,
      position: i + 1,
      image: review.capture === 'image' ? await assetDataUrl(review.imageAssetId) : undefined,
      tags: tagList.filter((t) => review.tags.includes(t.id)),
      coaches: coachReadings
        .map((coach) => ({ name: coach.coachName, reading: coach.byIndex.get(i) }))
        .filter((row): row is { name: string; reading: HandReading } => !!row.reading),
    });
  }
  return {
    title,
    generatedAt: new Date(),
    items,
    summary: await ownAssessment(hands),
    coaches: coachReadings.map((coach) => ({
      name: coach.coachName,
      summary: coach.summary,
      completed: !!coach.completedAt,
    })),
  };
}

/** One-line header for a hand inside the report. */
export function handHeadline(item: ReportItem): string {
  const h = item.hand;
  const room = siteName(h.site);
  const game =
    h.gameType === 'tournament'
      ? `${h.tournament?.id ? `#${h.tournament.id}` : ''} ${h.tournament?.level ?? ''}`.trim()
      : `${h.tableName}`;
  return [`#${item.position}`, `Hand ${h.handNumber}`, room, game].filter(Boolean).join(' · ');
}
