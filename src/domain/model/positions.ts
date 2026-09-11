import type { Hand } from './types';

/**
 * Position labels are deliberately NOT translated (poker convention is global).
 */
export type PositionLabel =
  'BTN' | 'SB' | 'BB' | 'STR' | 'UTG' | 'UTG+1' | 'UTG+2' | 'MP' | 'MP+1' | 'LJ' | 'HJ' | 'CO';

/**
 * Names for the non-blind seats, ordered from first-to-act preflop up to CO,
 * indexed by how many such seats the table has.
 */
const EARLY_TO_LATE: Record<number, PositionLabel[]> = {
  0: [],
  1: ['CO'],
  2: ['HJ', 'CO'],
  3: ['LJ', 'HJ', 'CO'],
  4: ['UTG', 'LJ', 'HJ', 'CO'],
  5: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  6: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO'],
  7: ['UTG', 'UTG+1', 'MP', 'MP+1', 'LJ', 'HJ', 'CO'],
};

/**
 * Seat order starting at the button and walking clockwise (i.e. the order the
 * dealer deals), restricted to players actually dealt in.
 */
export function seatsFromButton(hand: Hand): number[] {
  const seats = hand.players
    .filter((p) => !p.isSittingOut)
    .map((p) => p.seat)
    .sort((a, b) => a - b);
  if (seats.length === 0) return [];
  // Button seat may itself be sitting out (moved tables); anchor on the closest.
  let start = seats.findIndex((s) => s >= hand.buttonSeat);
  if (start < 0) start = 0;
  if (seats[start] !== hand.buttonSeat) {
    // Button is a seat with no player: anchor just before it so ordering holds.
    start = (start - 1 + seats.length) % seats.length;
  }
  return seats.slice(start).concat(seats.slice(0, start));
}

/** Map of player name -> position label for this hand. */
export function computePositions(hand: Hand): Record<string, PositionLabel> {
  const order = seatsFromButton(hand);
  const bySeat = new Map(hand.players.map((p) => [p.seat, p]));
  const names = order.map((s) => bySeat.get(s)?.name).filter((n): n is string => !!n);
  const out: Record<string, PositionLabel> = {};
  const n = names.length;
  if (n === 0) return out;
  if (n === 2) {
    // Heads-up: the button is the small blind.
    out[names[0]] = 'SB';
    if (names[1]) out[names[1]] = 'BB';
    return out;
  }
  out[names[0]] = 'BTN';
  if (names[1]) out[names[1]] = 'SB';
  if (names[2]) out[names[2]] = 'BB';
  const rest = names.slice(3);
  const labels = EARLY_TO_LATE[rest.length] ?? EARLY_TO_LATE[7];
  rest.forEach((name, i) => {
    out[name] = labels[i] ?? 'MP';
  });
  return out;
}

/** Preflop action order: first to act is UTG (or the button heads-up). */
export function preflopOrder(hand: Hand): string[] {
  const order = seatsFromButton(hand);
  const bySeat = new Map(hand.players.map((p) => [p.seat, p]));
  const names = order.map((s) => bySeat.get(s)?.name).filter((n): n is string => !!n);
  if (names.length <= 2) return names;
  return names.slice(3).concat(names.slice(0, 3));
}
