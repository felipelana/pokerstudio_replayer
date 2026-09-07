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
  animations: boolean;
  /** Global neon switch; the colour and strength come from the skin. */
  neon?: boolean;
  potOdds?: PotOdds;
  fmt: (v: number) => string;
  exact: (v: number) => string;
  onSeatClick?: (player: string) => void;
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
