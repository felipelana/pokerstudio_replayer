import { cardIndex } from '../model/cards.ts';
import { evaluate } from './evaluator.ts';

export interface EquityPlayer {
  name: string;
  /** Two card codes, or undefined for an unknown (random) hand. */
  cards?: string[];
}

export interface EquityInput {
  board: string[];
  players: EquityPlayer[];
  iterations: number;
  /** Optional seed for reproducible tests. */
  seed?: number;
}

/** xorshift32 — fast, good enough for Monte Carlo. */
function rng(seed: number) {
  let x = seed || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/**
 * Equity per player (0..1). Unknown players are dealt random cards from the
 * remaining deck; unknown board cards are sampled. Uses exact enumeration when
 * everyone is known and at most 2 board cards are missing.
 */
export function computeEquities(input: EquityInput): Record<string, number | undefined> {
  const { board, players } = input;
  const n = players.length;
  const out: Record<string, number | undefined> = {};
  if (n === 0) return out;
  if (n === 1) {
    out[players[0].name] = players[0].cards ? 1 : undefined;
    return out;
  }

  const used = new Set<number>();
  const boardIdx = board.map(cardIndex);
  boardIdx.forEach((c) => used.add(c));
  const holes: (number[] | undefined)[] = players.map((p) => {
    if (!p.cards || p.cards.length !== 2) return undefined;
    const idx = p.cards.map(cardIndex);
    idx.forEach((c) => used.add(c));
    return idx;
  });
  const deck: number[] = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c);

  const missingBoard = 5 - boardIdx.length;
  const unknownPlayers = holes.filter((h) => !h).length;
  const wins = new Float64Array(n);
  const hand = new Int32Array(7);
  const scores = new Int32Array(n);

  const scoreAll = (fullBoard: ArrayLike<number>, dealt: (number[] | undefined)[]) => {
    for (let i = 0; i < 5; i++) hand[i] = fullBoard[i];
    let best = -1;
    let count = 0;
    for (let p = 0; p < n; p++) {
      const h = dealt[p]!;
      hand[5] = h[0];
      hand[6] = h[1];
      const s = evaluate(hand, 7);
      scores[p] = s;
      if (s > best) {
        best = s;
        count = 1;
      } else if (s === best) count++;
    }
    const share = 1 / count;
    for (let p = 0; p < n; p++) if (scores[p] === best) wins[p] += share;
  };

  let samples = 0;

  if (unknownPlayers === 0 && missingBoard <= 2) {
    // Exact enumeration of the remaining board cards.
    const full = new Int32Array(5);
    for (let i = 0; i < boardIdx.length; i++) full[i] = boardIdx[i];
    if (missingBoard === 0) {
      scoreAll(full, holes);
      samples = 1;
    } else if (missingBoard === 1) {
      for (const c of deck) {
        full[4] = c;
        scoreAll(full, holes);
        samples++;
      }
    } else {
      for (let i = 0; i < deck.length; i++) {
        full[3] = deck[i];
        for (let j = i + 1; j < deck.length; j++) {
          full[4] = deck[j];
          scoreAll(full, holes);
          samples++;
        }
      }
    }
  } else {
    // Monte Carlo
    const rand = rng(input.seed ?? (Date.now() & 0x7fffffff));
    const iterations = Math.max(1, input.iterations);
    const need = missingBoard + unknownPlayers * 2;
    const pool = deck.slice();
    const full = new Int32Array(5);
    for (let i = 0; i < boardIdx.length; i++) full[i] = boardIdx[i];
    const dealt: (number[] | undefined)[] = holes.map((h) => (h ? h : [0, 0]));
    for (let it = 0; it < iterations; it++) {
      // Partial Fisher-Yates: draw `need` cards from the pool.
      for (let k = 0; k < need; k++) {
        const j = k + Math.floor(rand() * (pool.length - k));
        const tmp = pool[k];
        pool[k] = pool[j];
        pool[j] = tmp;
      }
      let k = 0;
      for (let b = boardIdx.length; b < 5; b++) full[b] = pool[k++];
      for (let p = 0; p < n; p++) {
        if (!holes[p]) {
          dealt[p]![0] = pool[k++];
          dealt[p]![1] = pool[k++];
        }
      }
      scoreAll(full, dealt);
      samples++;
    }
  }

  players.forEach((p, i) => {
    out[p.name] = holes[i] ? wins[i] / samples : undefined;
  });
  return out;
}
