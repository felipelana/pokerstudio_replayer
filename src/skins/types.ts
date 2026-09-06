import type { Suit } from '@/model/cards';

export type DeckStyle = 'filled' | 'outlined';
export type BackPattern = 'diamonds' | 'grid' | 'dots' | 'plain';
export type RankFont = 'Inter' | 'Roboto Mono' | 'serif';

export interface DeckSkin {
  style: DeckStyle;
  /** 2 = classic (spades/clubs share, hearts/diamonds share), 4 = one colour per suit. */
  colorMode: 2 | 4;
  suitColors: Record<Suit, string>;
  cardBg: string;
  /** Rank/pip colour used on filled cards (usually white). */
  inkOnFilled: string;
  backColor: string;
  backPattern: BackPattern;
  backInk: string;
  rankFont: RankFont;
  /** 0..1 as a fraction of card width. */
  cornerRadius: number;
  /**
   * How a player's two hole cards sit next to each other.
   * 'spread' = side by side; 'overlap' = fanned, second card on top.
   * Undefined behaves as 'spread' (skins saved before this option existed).
   */
  holeLayout?: 'spread' | 'overlap';
  /**
   * J/Q/K artwork: 'letter' keeps the plain rank + big pip, 'figure' draws the
   * jack, queen and king silhouettes like a real deck. Undefined = 'letter'.
   */
  courtStyle?: 'letter' | 'figure';
}

export interface FeltSkin {
  color: string;
  /** 0..1 */
  textureIntensity: number;
  vignetteColor: string;
  /** 0..1 */
  vignetteStrength: number;
  logoText?: string;
  /** IndexedDB asset id of an uploaded PNG/SVG. */
  logoAssetId?: string;
  logoOpacity: number;
}

export interface TableSkin {
  railColor: string;
  railHighlight: string;
  /** Fraction of table width, 0.02..0.12 */
  railWidth: number;
  /** 0..1 */
  railShine: number;
  /** height / width of the ellipse */
  aspect: number;
  /** Glowing edge around the felt. 0 (or undefined) disables it for this skin. */
  neonIntensity?: number;
  neonColor?: string;
}

export interface UiSkin {
  bg: string;
  bgEnd: string;
  surface: string;
  surface2: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
}

export const CHIP_DENOMINATIONS = [
  1, 5, 25, 100, 500, 1000, 5000, 25000, 100000, 500000, 1000000,
] as const;
export type ChipDenomination = (typeof CHIP_DENOMINATIONS)[number];

export interface ChipSkin {
  colors: Record<string, string>;
  edge: string;
  dealerButton: string;
  dealerButtonInk: string;
}

export interface PlateSkin {
  bg: string;
  border: string;
  activeBorder: string;
  text: string;
  textMuted: string;
  foldLabel: string;
  allInLabel: string;
  heroBorder: string;
  winnerGlow: string;
  /**
   * Halo around the player who is acting. Falls back to `activeBorder`, and
   * `activeGlowStrength` (0..1, default 0.5) sets how far it spreads.
   */
  activeGlow?: string;
  activeGlowStrength?: number;
}

export interface Skin {
  id: string;
  name: string;
  theme: 'dark' | 'light';
  isBuiltIn?: boolean;
  createdAt?: number;
  updatedAt?: number;
  deck: DeckSkin;
  felt: FeltSkin;
  table: TableSkin;
  ui: UiSkin;
  chips: ChipSkin;
  plates: PlateSkin;
}
