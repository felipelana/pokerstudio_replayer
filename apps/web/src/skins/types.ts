import type { Suit } from '@/model/cards';

export type DeckStyle = 'filled' | 'outlined';
export type BackPattern = 'diamonds' | 'grid' | 'dots' | 'plain';
export type RankFont = 'Inter' | 'Roboto Mono' | 'serif';

export interface DeckSkin {
  style: DeckStyle;
  /** 2 = classic (spades/clubs share, hearts/diamonds share), 4 = one colour per suit. */
  colorMode: 2 | 4;
  suitColors: Record<Suit, string>;
  /**
   * Per-rank ink, for a deck where individual cards are coloured by hand.
   * Only the ranks present here override the suit colour; the rest follow it.
   */
  rankColors?: Partial<Record<string, string>>;
  /**
   * Artwork per rank, by asset id. A card with art keeps its corner indices and
   * loses the centre pip; the rest of the deck stays drawn.
   */
  rankImages?: Partial<Record<string, string>>;
  /**
   * Gap between the flop, turn and river cards, as a share of a card width.
   * The quick controls can override it for one session. Undefined = 0.36.
   */
  boardGap?: number;
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
   * How a player's two hole cards sit next to each other. 'spread' = side by
   * side; 'overlap' = the second card resting on the first; 'fan' = overlapped
   * and tilted apart, the way a hand is held. Undefined behaves as 'spread'.
   */
  holeLayout?: 'spread' | 'overlap' | 'fan';
}

export interface FeltSkin {
  color: string;
  /** 0..1 */
  textureIntensity: number;
  vignetteColor: string;
  /** 0..1 */
  vignetteStrength: number;
  logoText?: string;
  /** IndexedDB asset id of an uploaded PNG/SVG, or `builtin:<name>`. */
  logoAssetId?: string;
  /**
   * How the watermark is composited. 'screen' drops the black background of
   * logos exported without an alpha channel; 'normal' keeps the image as is.
   */
  logoBlend?: 'normal' | 'screen';
  logoOpacity: number;
}

export interface TableSkin {
  /**
   * How much of the available area the table fills. 1 = as before; higher
   * values push the felt towards the edges. The replayer's zoom multiplies it.
   */
  scale?: number;
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
  /** Table outline (R20). Undefined = ellipse. */
  shape?: TableShapeName;
  /** Inner groove following the felt contour — the finishing detail (R20). */
  bevel?: {
    /** Stroke width, in fractions of the short radius. */
    width: number;
    color: string;
    /** 0..1 */
    opacity: number;
    /** Distance from the felt edge, in fractions of the short radius. */
    inset: number;
  };
}

import type { TableShapeName } from '@/renderers/tableShape';

export interface BackgroundSkin {
  mode: 'color' | 'gradient' | 'image';
  /** Base colour; also the layer an image composites over. */
  color: string;
  gradient?: {
    type: 'linear' | 'radial';
    /** degrees, linear only */
    angle: number;
    stops: { color: string; at: number }[];
  };
  imageAssetId?: string;
  /** 0..1 */
  imageOpacity?: number;
  imageFit?: 'cover' | 'contain' | 'repeat' | 'center';
  /** px */
  blur?: number;
}

export type LogoCorner = 'none' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface UiSkin {
  bg: string;
  bgEnd: string;
  surface: string;
  surface2: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
  /** Backdrop behind the table (R15). Undefined = the bg/bgEnd gradient. */
  background?: BackgroundSkin;
  /** Logo pinned to a corner of the table area (IndexedDB asset id). */
  logoAssetId?: string;
  logoCorner?: LogoCorner;
  /** Rendered height in px (default 44). */
  logoSize?: number;
  /** 0..1 (default 0.85). */
  logoOpacity?: number;
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
  /**
   * Built-in this skin was first saved from. Saving that built-in again updates
   * this copy instead of making another one.
   */
  derivedFrom?: string;
  createdAt?: number;
  updatedAt?: number;
  deck: DeckSkin;
  felt: FeltSkin;
  table: TableSkin;
  ui: UiSkin;
  chips: ChipSkin;
  plates: PlateSkin;
}
