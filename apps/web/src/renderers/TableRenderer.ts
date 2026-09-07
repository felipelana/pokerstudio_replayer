import type { ComponentType } from 'react';
import type { Frame, PotOdds } from '@/engine/replay';
import type { Hand } from '@/model/types';
import type { PositionLabel } from '@/model/positions';
import type { Skin } from '@/skins/types';
import type { SeatSlot } from './layout';

export interface TableRendererProps {
  hand: Hand;
  frame: Frame;
  skin: Skin;
  slots: SeatSlot[];
  /** Effective hero (file hero or focus override). */
  heroName?: string;
  positions: Record<string, PositionLabel>;
  showKnownHands: boolean;
  /** Hero's own cards forced face down (R8). */
  hideHeroCards?: boolean;
  /** Leaves the board out, to look at the felt itself (skin editor). */
  hideBoard?: boolean;
  /** External lookup URL for a nick, when configured (R18). */
  lookupUrlFor?: (nick: string) => string;
  /** Overrides the skin's hole-card layout (R8). */
  holeLayout?: 'spread' | 'overlap' | 'fan';
  /** Independent scales for cards and for chips/bets (R21). */
  zoomCards?: number;
  /** Overrides the skin's board spacing for this session. */
  boardGapRatio?: number;
  /** Artwork per rank, when the skin sets any. */
  deckArt?: Record<string, HTMLImageElement>;
  zoomChips?: number;
  /** Denomination printed on the chips (R22). */
  chipDenominations?: boolean;
  animations: boolean;
  /** Global neon switch; the colour and strength come from the skin. */
  neon?: boolean;
  potOdds?: PotOdds;
  fmt: (v: number) => string;
  exact: (v: number) => string;
  onSeatClick?: (player: string) => void;
  /** Take a chair: the hero moves to that screen slot from now on. */
  onSitHere?: (slotIndex: number) => void;
  /** Used by the admin preview to disable interaction. */
  interactive?: boolean;
}

/**
 * A table renderer draws the felt, board, pots, chips and seats for one frame.
 * Two implementations: Three.js (default) and SVG (fallback / screenshots).
 */
export type TableRenderer = ComponentType<TableRendererProps>;

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
