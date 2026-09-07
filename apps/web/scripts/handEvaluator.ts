/**
 *
 * Kept here (not in src/) because the app no longer computes equity: only the
 * sample generator needs a hand-strength evaluator.
 * Fast 5..7-card Texas Hold'em evaluator in pure TypeScript.
 *
 * Cards are integers 0..51 = rank * 4 + suit (rank 0 = deuce … 12 = ace),
 * matching `cardIndex()` in the model. The result is a 32-bit score where a
 * higher number always beats a lower one:
 *
 *   category (4 bits) << 20 | kicker1 << 16 | kicker2 << 12 | … | kicker5
 *
 * Categories: 0 high card, 1 pair, 2 two pair, 3 trips, 4 straight, 5 flush,
 * 6 full house, 7 quads, 8 straight flush.
 */

export const CATEGORY_NAMES = [
  'high-card',
  'pair',
  'two-pair',
  'three-of-a-kind',
  'straight',
  'flush',
  'full-house',
  'four-of-a-kind',
  'straight-flush',
] as const;

/** For each 13-bit rank mask, the top rank of the best straight it contains (0xF = none). */
const STRAIGHT_TOP = new Uint8Array(1 << 13).fill(0xf);
(() => {
  for (let mask = 0; mask < 1 << 13; mask++) {
    let best = 0xf;
    // Wheel: A-2-3-4-5
    if ((mask & 0b1_0000_0000_1111) === 0b1_0000_0000_1111) best = 3;
    for (let top = 4; top <= 12; top++) {
      const need = 0b11111 << (top - 4);
      if ((mask & need) === need) best = top;
    }
    STRAIGHT_TOP[mask] = best;
  }
})();

/** Top `n` set bits of a 13-bit mask packed as 4-bit nibbles, high first. */
function topBits(mask: number, n: number): number {
  let out = 0;
  let count = 0;
  for (let r = 12; r >= 0 && count < n; r--) {
    if (mask & (1 << r)) {
      out = (out << 4) | r;
      count++;
    }
  }
  while (count < 5) {
    out <<= 4;
    count++;
  }
  return out;
}

const rankCounts = new Uint8Array(13);
const suitMasks = new Uint16Array(4);
const suitCounts = new Uint8Array(4);

/**
 * Evaluate 5 to 7 cards (as 0..51 integers). Not re-entrant (uses module
 * scratch buffers) — fine for the single-threaded worker.
 */
export function evaluate(cards: ArrayLike<number>, n = cards.length): number {
  rankCounts.fill(0);
  suitMasks.fill(0);
  suitCounts.fill(0);
  let rankMask = 0;
  for (let i = 0; i < n; i++) {
    const c = cards[i];
    const r = c >> 2;
    const s = c & 3;
    rankCounts[r]++;
    suitMasks[s] |= 1 << r;
    suitCounts[s]++;
    rankMask |= 1 << r;
  }

  // Flush / straight flush
  for (let s = 0; s < 4; s++) {
    if (suitCounts[s] >= 5) {
      const sf = STRAIGHT_TOP[suitMasks[s]];
      if (sf !== 0xf) return (8 << 20) | (sf << 16);
      return (5 << 20) | topBits(suitMasks[s], 5);
    }
  }

  // Count multiples
  let quads = -1;
  let trips = -1;
  let trips2 = -1;
  let pairHi = -1;
  let pairLo = -1;
  for (let r = 12; r >= 0; r--) {
    const c = rankCounts[r];
    if (c === 4) quads = r;
    else if (c === 3) {
      if (trips < 0) trips = r;
      else if (trips2 < 0) trips2 = r;
    } else if (c === 2) {
      if (pairHi < 0) pairHi = r;
      else if (pairLo < 0) pairLo = r;
    }
  }

  if (quads >= 0) {
    const kicker = topBits(rankMask & ~(1 << quads), 1) >> 16;
    return (7 << 20) | (quads << 16) | (kicker << 12);
  }
  if (trips >= 0 && (pairHi >= 0 || trips2 >= 0)) {
    const pair = trips2 >= 0 ? Math.max(trips2, pairHi) : pairHi;
    return (6 << 20) | (trips << 16) | (pair << 12);
  }
  const st = STRAIGHT_TOP[rankMask];
  if (st !== 0xf) return (4 << 20) | (st << 16);
  if (trips >= 0) {
    const kickers = topBits(rankMask & ~(1 << trips), 2);
    return (3 << 20) | (trips << 16) | (kickers >> 8);
  }
  if (pairHi >= 0 && pairLo >= 0) {
    const kicker = topBits(rankMask & ~(1 << pairHi) & ~(1 << pairLo), 1) >> 16;
    return (2 << 20) | (pairHi << 16) | (pairLo << 12) | (kicker << 8);
  }
  if (pairHi >= 0) {
    const kickers = topBits(rankMask & ~(1 << pairHi), 3);
    return (1 << 20) | (pairHi << 16) | (kickers >> 4);
  }
  return topBits(rankMask, 5);
}

export function categoryOf(score: number): number {
  return score >> 20;
}

export function categoryName(score: number): (typeof CATEGORY_NAMES)[number] {
  return CATEGORY_NAMES[categoryOf(score)];
}
