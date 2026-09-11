import type { Hand } from '@/domain/model/types';

/**
 * Seat layout on a unit ellipse. All coordinates are normalised: x in [-1, 1]
 * along the table's long axis, y in [-1, 1] along the short axis, with +y
 * pointing towards the viewer (bottom of the screen). Both renderers map these
 * to their own space.
 */
export interface SeatSlot {
  seat: number;
  /** Position on screen, 0 = bottom centre, walking clockwise. */
  index: number;
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

/**
 * How far the seats sit outside the felt, as a fraction of the gap that used to
 * separate them from it: 0 puts a plate on the cloth's edge, 1 well clear of
 * the rail. Below about 0.7 the plate and its cards lean over the rail, which
 * is how a real table reads and what the replayer now does by default.
 */
export const SEAT_DISTANCE_DEFAULT = 0.55;

export interface LayoutOptions {
  maxSeats: number;
  /** Seat that should sit at the bottom centre (hero / focus). */
  anchorSeat?: number;
  /** Seat that holds the dealer button (used when there is no anchor). */
  buttonSeat?: number;
  /** false = physical seats, no rotation. */
  rotate?: boolean;
  /** Screen slot the anchor should occupy; 0 (bottom centre) by default. */
  heroSlot?: number;
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
  // Where the reader has chosen to sit: the whole ring turns with them, so
  // every other player keeps their place relative to the hero.
  const seatShift =
    opts.anchorSeat !== undefined ? ((Math.round(opts.heroSlot ?? 0) % n) + n) % n : 0;
  const slots: SeatSlot[] = [];
  for (let seat = 1; seat <= n; seat++) {
    const i = (seat - 1 - offset + seatShift + n) % n;
    const angle = Math.PI / 2 + (2 * Math.PI * i) / n;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Plates sit beyond the rail. Bets sit well inside the felt: pushed further
    // out they end up behind the plate that names the player, and the chips
    // stop being readable. avoidZones can still slide one outwards, but only
    // when it would otherwise land on the board or the pot.
    slots.push({
      seat,
      index: i,
      x: cos * 1.0,
      y: sin * 1.0,
      betX: cos * 0.62,
      betY: sin * 0.58,
      // Between the board and the bet ring, so the button never lands on a card.
      buttonX: Math.cos(angle - 0.34) * 0.8,
      buttonY: Math.sin(angle - 0.34) * 0.78,
      angle,
    });
  }
  return slots;
}

/* ------------------------------------------------------------------ */
/* Containment (R2) and reserved zones (R4)                            */
/* ------------------------------------------------------------------ */

/** Axis-aligned box in normalised felt space (centre + half extents). */
export interface FeltBox {
  x: number;
  y: number;
  /** half width */
  hw: number;
  /** half height */
  hh: number;
}

const inside = (b: FeltBox, margin: number): boolean =>
  Math.hypot(Math.abs(b.x) + b.hw, Math.abs(b.y) + b.hh) <= 1 - margin;

/**
 * Pull a box towards the centre until it lies completely inside the felt
 * ellipse, keeping its size. Works in normalised space, so it holds at any
 * resolution, zoom or table aspect.
 */
export function clampToFelt(box: FeltBox, margin = 0.02): { x: number; y: number } {
  if (inside(box, margin)) return { x: box.x, y: box.y };
  // The box may be larger than the felt: then the best we can do is centre it.
  if (Math.hypot(box.hw, box.hh) >= 1 - margin) return { x: 0, y: 0 };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inside({ ...box, x: box.x * mid, y: box.y * mid }, margin)) lo = mid;
    else hi = mid;
  }
  return { x: box.x * lo, y: box.y * lo };
}

export function boxesOverlap(a: FeltBox, b: FeltBox): boolean {
  return Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh;
}

/**
 * Slide a box away from the table centre until it clears every reserved zone
 * (board band, pot block), then clamp it back inside the felt. Information
 * therefore never overlaps: it moves, or it stays put if there is no room.
 */
export function avoidZones(
  box: FeltBox,
  zones: FeltBox[],
  margin = 0.02,
): { x: number; y: number } {
  const len = Math.hypot(box.x, box.y) || 1;
  const dx = box.x / len;
  const dy = box.y / len;
  let candidate = { ...box };
  for (let step = 0; step < 24; step++) {
    if (!zones.some((z) => boxesOverlap(candidate, z))) break;
    candidate = { ...candidate, x: candidate.x + dx * 0.04, y: candidate.y + dy * 0.04 };
  }
  return clampToFelt(candidate, margin);
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
