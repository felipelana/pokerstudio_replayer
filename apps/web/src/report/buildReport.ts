import type { Hand, Review, UserTag } from '@/model/types';
import { getRepository } from '@/db/repository';
import { siteName } from '@/model/sites';

export interface ReportItem {
  hand: Hand;
  review: Review;
  /** Index in the session, 1-based, so the report matches the hand list. */
  position: number;
  /** Data URL of the captured table, when the user asked for a picture. */
  image?: string;
  tags: UserTag[];
}

export interface ReportData {
  title: string;
  generatedAt: Date;
  items: ReportItem[];
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
export async function buildReport(hands: Hand[], title: string, tagList: UserTag[]): Promise<ReportData> {
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
    });
  }
  return { title, generatedAt: new Date(), items };
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
