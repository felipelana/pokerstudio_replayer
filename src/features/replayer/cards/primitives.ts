import type { CardCode, Suit } from '@/domain/model/cards';
import { rankOf, suitOf } from '@/domain/model/cards';
import type { DeckSkin } from '@/lib/skins/types';

/**
 * A card is described as a small list of drawing primitives in a 100x140
 * coordinate space. The SVG component and the canvas texture generator both
 * consume this — one drawing function, two outputs.
 */
export const CARD_W = 100;
export const CARD_H = 140;

/** Suit glyphs as SVG paths in a 100x100 box (no font glyphs — identical everywhere). */
export const SUIT_PATHS: Record<Suit, string> = {
  s: 'M50 4 C50 4 12 40 12 62 C12 78 26 86 40 78 C39 88 34 94 26 97 L74 97 C66 94 61 88 60 78 C74 86 88 78 88 62 C88 40 50 4 50 4 Z',
  h: 'M50 94 C50 94 8 64 8 36 C8 20 20 8 34 8 C41 8 47 12 50 18 C53 12 59 8 66 8 C80 8 92 20 92 36 C92 64 50 94 50 94 Z',
  d: 'M50 3 L92 50 L50 97 L8 50 Z',
  c: 'M50 4 m-19 0 a19 19 0 1 0 38 0 a19 19 0 1 0 -38 0 M26 50 m-19 0 a19 19 0 1 0 38 0 a19 19 0 1 0 -38 0 M74 50 m-19 0 a19 19 0 1 0 38 0 a19 19 0 1 0 -38 0 M50 34 L64 56 L36 56 Z M42 52 L58 52 L62 97 L38 97 Z',
};

/**
 * Court figures for J/Q/K, drawn as silhouettes in a 100x100 box so they take
 * the ink colour of the suit and stay crisp at any size (no bitmap artwork).
 */
export const COURT_PATHS: Record<'J' | 'Q' | 'K', string[]> = {
  K: [
    // Crown with three peaks and a cross on the middle one
    'M18 33 L25 11 L37 23 L50 4 L63 23 L75 11 L82 33 Z',
    'M17 33 h66 v9 H17 Z',
    'M47 0 h6 v4 h4 v6 h-4 v5 h-6 v-5 h-4 V4 h4 Z',
    // Head
    'M50 40 a12.5 12.5 0 1 1 -0.01 0 Z',
    // Beard
    'M37.5 55 q0 23 12.5 27 q12.5 -4 12.5 -27 q-5.5 7.5 -12.5 7.5 q-7 0 -12.5 -7.5 Z',
    // Shoulders
    'M20 100 q4 -19 30 -19 q26 0 30 19 Z',
  ],
  Q: [
    // Tiara with pearls
    'M27 34 q2 -17 7 -17 q4 0 6 9 q3 -15 10 -15 q7 0 10 15 q2 -9 6 -9 q5 0 7 17 Z',
    'M34 12 a4 4 0 1 1 -0.01 0 Z',
    'M50 6 a4.5 4.5 0 1 1 -0.01 0 Z',
    'M66 12 a4 4 0 1 1 -0.01 0 Z',
    // Head
    'M50 40 a12.5 12.5 0 1 1 -0.01 0 Z',
    // Hair falling on both sides
    'M36 43 q-9 22 -3 40 q-11 -6 -9 -24 q1.5 -12 12 -16 Z',
    'M64 43 q9 22 3 40 q11 -6 9 -24 q-1.5 -12 -12 -16 Z',
    // Shoulders
    'M20 100 q4 -19 30 -19 q26 0 30 19 Z',
  ],
  J: [
    // Cap and feather
    'M28 33 q-3 -21 22 -21 q25 0 22 21 Z',
    'M70 20 q15 -12 20 -1 q-11 1 -16 8 Z',
    // Head
    'M50 40 a12.5 12.5 0 1 1 -0.01 0 Z',
    // Ruff collar
    'M25 78 l8.5 -7 l8 7 l8.5 -7 l8 7 l8.5 -7 l8 7 v7 H25 Z',
    // Shoulders
    'M22 100 q4 -14 28 -14 q24 0 28 14 Z',
  ],
};

export type Primitive =
  | {
      kind: 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      rx: number;
      fill: string;
      stroke?: string;
      strokeWidth?: number;
    }
  | {
      kind: 'text';
      x: number;
      y: number;
      text: string;
      size: number;
      fill: string;
      weight: number;
      font: string;
      anchor: 'start' | 'middle' | 'end';
    }
  | {
      kind: 'path';
      d: string;
      fill: string;
      /** Translate then scale the 100x100 path box. */
      x: number;
      y: number;
      scale: number;
    }
  | { kind: 'pattern'; pattern: DeckSkin['backPattern']; ink: string; inset: number }
  /** Glossy highlight: white → transparent diagonal sheen over the whole face. */
  | { kind: 'gloss'; rx: number; strength: number };

export function fontFamily(font: DeckSkin['rankFont']): string {
  switch (font) {
    case 'Roboto Mono':
      return '"Roboto Mono", ui-monospace, Menlo, monospace';
    case 'serif':
      return 'Georgia, "Times New Roman", serif';
    default:
      return 'Inter, "Noto Sans", system-ui, -apple-system, sans-serif';
  }
}

export function rankLabel(rank: string): string {
  return rank === 'T' ? '10' : rank;
}

/**
 * Colour of the ink (rank + pips) and of the card face. A rank listed in
 * `rankColors` wins over its suit, which is how a hand-coloured deck works.
 */
export function cardColors(
  suit: Suit,
  deck: DeckSkin,
  rank?: string,
): { face: string; ink: string; edge: string } {
  const suitColor = (rank && deck.rankColors?.[rank]) || deck.suitColors[suit];
  if (deck.style === 'filled') {
    return { face: suitColor, ink: deck.inkOnFilled, edge: 'rgba(0,0,0,0.25)' };
  }
  return { face: deck.cardBg, ink: suitColor, edge: 'rgba(0,0,0,0.18)' };
}

export function cardPrimitives(
  card: CardCode | 'back',
  deck: DeckSkin,
  hasArt = false,
): Primitive[] {
  const rx = Math.max(0, Math.min(0.3, deck.cornerRadius)) * CARD_W;
  if (card === 'back') {
    return [
      { kind: 'rect', x: 0, y: 0, w: CARD_W, h: CARD_H, rx, fill: deck.cardBg },
      {
        kind: 'rect',
        x: 6,
        y: 6,
        w: CARD_W - 12,
        h: CARD_H - 12,
        rx: Math.max(0, rx - 4),
        fill: deck.backColor,
      },
      { kind: 'pattern', pattern: deck.backPattern, ink: deck.backInk, inset: 10 },
      { kind: 'gloss', rx, strength: 0.28 },
    ];
  }
  const rank = rankOf(card);
  const suit = suitOf(card);
  const { face, ink, edge } = cardColors(suit, deck, rank);
  const label = rankLabel(rank);
  const font = fontFamily(deck.rankFont);
  const rankSize = label.length > 1 ? 40 : 46;
  return [
    {
      kind: 'rect',
      x: 0,
      y: 0,
      w: CARD_W,
      h: CARD_H,
      rx,
      fill: face,
      stroke: edge,
      strokeWidth: 2,
    },
    {
      kind: 'text',
      x: 8,
      y: 44,
      text: label,
      size: rankSize,
      fill: ink,
      weight: 700,
      font,
      anchor: 'start',
    },
    { kind: 'path', d: SUIT_PATHS[suit], fill: ink, x: 8, y: 50, scale: 0.3 },
    ...(hasArt ? [] : centrePiece(suit, ink)),
    { kind: 'gloss', rx, strength: deck.style === 'filled' ? 0.22 : 0.16 },
  ];
}

/** The big suit pip in the middle of the card. */
function centrePiece(suit: Suit, ink: string): Primitive[] {
  return [{ kind: 'path', d: SUIT_PATHS[suit], fill: ink, x: 33, y: 68, scale: 0.64 }];
}

/** Gloss gradient stops shared by SVG and canvas (offset 0..1, alpha). */
export function glossStops(strength: number): { offset: number; alpha: number }[] {
  return [
    { offset: 0, alpha: strength },
    { offset: 0.45, alpha: strength * 0.25 },
    { offset: 0.5, alpha: 0 },
    { offset: 1, alpha: 0 },
  ];
}

/** Pattern helpers shared by SVG and canvas (list of simple shapes). */
export function patternShapes(
  pattern: DeckSkin['backPattern'],
  inset: number,
): { kind: 'circle' | 'diamond' | 'line'; x: number; y: number; w: number; h: number }[] {
  const out: { kind: 'circle' | 'diamond' | 'line'; x: number; y: number; w: number; h: number }[] =
    [];
  const x0 = inset,
    y0 = inset,
    x1 = CARD_W - inset,
    y1 = CARD_H - inset;
  if (pattern === 'plain') return out;
  const step = 12;
  if (pattern === 'dots') {
    for (let y = y0 + 6; y < y1; y += step)
      for (let x = x0 + 6; x < x1; x += step) out.push({ kind: 'circle', x, y, w: 1.8, h: 1.8 });
  } else if (pattern === 'diamonds') {
    for (let y = y0 + 6; y < y1; y += step)
      for (let x = x0 + 6 + ((Math.round((y - y0) / step) % 2) * step) / 2; x < x1; x += step)
        out.push({ kind: 'diamond', x, y, w: 4, h: 6 });
  } else if (pattern === 'grid') {
    for (let x = x0; x <= x1; x += step) out.push({ kind: 'line', x, y: y0, w: 0, h: y1 - y0 });
    for (let y = y0; y <= y1; y += step) out.push({ kind: 'line', x: x0, y, w: x1 - x0, h: 0 });
  }
  return out;
}
