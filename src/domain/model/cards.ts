export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const SUITS = ['s', 'h', 'd', 'c'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
/** Two-character card code, e.g. 'Ah', 'Td', '6s'. */
export type CardCode = string;

export const SUIT_NAMES: Record<Suit, string> = {
  s: 'spades',
  h: 'hearts',
  d: 'diamonds',
  c: 'clubs',
};

export function isCard(code: string): boolean {
  if (code.length !== 2) return false;
  return (
    (RANKS as readonly string[]).includes(code[0]) && (SUITS as readonly string[]).includes(code[1])
  );
}

export function rankOf(code: CardCode): Rank {
  return code[0] as Rank;
}

export function suitOf(code: CardCode): Suit {
  return code[1] as Suit;
}

/** 0..51 — rank-major index, matching the evaluator's deck ordering. */
export function cardIndex(code: CardCode): number {
  const r = RANKS.indexOf(code[0] as Rank);
  const s = SUITS.indexOf(code[1] as Suit);
  if (r < 0 || s < 0) throw new Error(`Invalid card: ${code}`);
  return r * 4 + s;
}

export function cardFromIndex(index: number): CardCode {
  return `${RANKS[Math.floor(index / 4)]}${SUITS[index % 4]}`;
}

export const FULL_DECK: CardCode[] = Array.from({ length: 52 }, (_, i) => cardFromIndex(i));

/** Parse "[Ah Kd]" or "Ah Kd" into ['Ah','Kd']; ignores anything unparseable. */
export function parseCards(text: string): CardCode[] {
  const inner = text.replace(/[[\]]/g, ' ');
  return inner
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => isCard(t));
}
