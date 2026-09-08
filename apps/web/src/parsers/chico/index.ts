import type { Hand, Site } from '@/model/types';
import { PokerStarsParser } from '../pokerstars';
import type { HandHistoryParser } from '../types';
import { chicoConfidence } from './signature';

/**
 * Chico Poker Network — BetOnline, TigerGaming, Sportsbetting and the rest of
 * the skins.
 *
 * The body is the PokerStars grammar, line for line, so it is reused rather
 * than copied: a copy would drift the first time either room changed a verb.
 * What differs is the header — a tournament id like 916-1a5ca85 and a level
 * with no number — and what is absent: no "Dealt to", no hole cards before the
 * showdown, and no all-in marker anywhere. Every hand therefore parses without
 * a hero, which the replayer already reads as observer mode.
 */
export class ChicoParser extends PokerStarsParser {
  override site: Site = 'chico';
  override displayName = 'Chico (BetOnline / TigerGaming)';

  override detect(text: string): number {
    return chicoConfidence(text.slice(0, 4000));
  }

  override parse(handText: string): Omit<Hand, 'id'> {
    const hand = super.parse(handText);
    // Stated rather than left to be noticed: nobody is the hero in these files.
    return { ...hand, site: 'chico', heroName: undefined };
  }
}

export const chicoParser: HandHistoryParser = new ChicoParser();
