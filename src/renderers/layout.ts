import type { Hand } from '@/model/types';

/**
 * Seat layout on a unit ellipse. All coordinates are normalised: x in [-1, 1]
 * along the table's long axis, y in [-1, 1] along the short axis, with +y
 * pointing towards the viewer (bottom of the screen). Both renderers map these
 * to their own space.
 */
export interface SeatSlot {
  seat: number;
  /** Position of the player plate (slightly outside the felt). */
  x: number;
  y: number;
  /** Position where this seat's bet chips are stacked (towards the centre). */
  betX: number;
  betY: number;
  /** Position of the dealer button when this seat has it. */
  buttonX: number;
  buttonY: number;
  /** Angle in radians (screen coords, +y down). */
  angle: number;
}

export interface LayoutOptions {
  maxSeats: number;
  /** Seat that should sit at the bottom centre (hero / focus). */
  anchorSeat?: number;
  /** Seat that holds the dealer button (used when there is no anchor). */
  buttonSeat?: number;
  /** false = physical seats, no rotation. */
  rotate?: boolean;
}

/**
 * Slot i (0 = bottom centre) lies at angle π/2 + 2πi/n, so increasing i walks
 * clockwise on screen (bottom → left → top → right), matching seat order.
 */
export function computeSeatSlots(opts: LayoutOptions): SeatSlot[] {
  const n = Math.max(2, opts.maxSeats);
  let offset = 0;
  if (opts.rotate !== false) {
    if (opts.anchorSeat !== undefined) offset = opts.anchorSeat - 1;
    else if (opts.buttonSeat !== undefined) {
      // No hero: put the button at the bottom-right slot (n-1 => just right of centre).
      offset = (opts.buttonSeat - 1 - (n - 1) + n) % n;
    }
  }
  const slots: SeatSlot[] = [];
  for (let seat = 1; seat <= n; seat++) {
    const i = (seat - 1 - offset + n) % n;
    const angle = Math.PI / 2 + (2 * Math.PI * i) / n;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Plates sit a little beyond the rail, bets on the felt.
    slots.push({
      seat,
      x: cos * 1.0,
      y: sin * 1.0,
      betX: cos * 0.6,
      betY: sin * 0.58,
      buttonX: Math.cos(angle - 0.35) * 0.72,
      buttonY: Math.sin(angle - 0.35) * 0.7,
      angle,
    });
  }
  return slots;
}

export function anchorSeatFor(hand: Hand, focusPlayer?: string): number | undefined {
  const name = focusPlayer ?? hand.heroName;
  if (!name) return undefined;
  return hand.players.find((p) => p.name === name)?.seat;
}

/* ------------------------------------------------------------------ */
/* Chip stacks                                                         */
/* ------------------------------------------------------------------ */

const DENOMS = [1000000, 500000, 100000, 25000, 5000, 1000, 500, 100, 25, 5, 1];

/**
 * Break an amount into chip denominations, largest first, capped so a stack
 * never becomes absurdly tall. Cash amounts are scaled to cents.
 */
export function chipBreakdown(amount: number, isCash: boolean, maxChips = 12): number[] {
  let units = Math.round(isCash ? amount * 100 : amount);
  if (units <= 0) return [];
  const chips: number[] = [];
  for (const d of DENOMS) {
    while (units >= d && chips.length < maxChips) {
      chips.push(d);
      units -= d;
    }
  }
  if (chips.length === 0) chips.push(DENOMS[DENOMS.length - 1]);
  return chips;
}
