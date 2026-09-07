import { describe, expect, it } from 'vitest';
import { avoidZones, boxesOverlap, chipBreakdown, clampToFelt, computeSeatSlots, type FeltBox } from './layout';
import { contrastRatio, readableInk } from '@/ui/contrast';

/** Worst corner of a box, in normalised felt space. */
const cornerRadius = (b: FeltBox, at: { x: number; y: number }) =>
  Math.hypot(Math.abs(at.x) + b.hw, Math.abs(at.y) + b.hh);

describe('clampToFelt (R2)', () => {
  it('leaves a box that already fits untouched', () => {
    const box: FeltBox = { x: 0.2, y: 0.1, hw: 0.05, hh: 0.04 };
    expect(clampToFelt(box)).toEqual({ x: 0.2, y: 0.1 });
  });

  it('pulls every out-of-bounds box back inside the felt', () => {
    // A long value ("1.234.567") near the rail, at many angles and sizes.
    for (let a = 0; a < 24; a++) {
      const angle = (a / 24) * Math.PI * 2;
      for (const radius of [0.8, 0.95, 1.1, 1.4]) {
        for (const hw of [0.04, 0.12, 0.2]) {
          const box: FeltBox = {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            hw,
            hh: 0.06,
          };
          const at = clampToFelt(box);
          expect(cornerRadius(box, at), `angle ${a} r ${radius} hw ${hw}`).toBeLessThanOrEqual(1.0001);
        }
      }
    }
  });

  it('centres a box that cannot fit at all', () => {
    expect(clampToFelt({ x: 0.9, y: 0.9, hw: 1.2, hh: 1.2 })).toEqual({ x: 0, y: 0 });
  });

  it('keeps a clamped box outside the reserved zones when there is room (R4)', () => {
    const board: FeltBox = { x: 0, y: 0, hw: 0.35, hh: 0.28 };
    const pot: FeltBox = { x: 0, y: 0.42, hw: 0.18, hh: 0.12 };
    const bet: FeltBox = { x: 0.05, y: 0.3, hw: 0.06, hh: 0.05 };
    const at = avoidZones(bet, [board, pot]);
    expect(boxesOverlap({ ...bet, ...at }, board)).toBe(false);
    expect(cornerRadius(bet, at)).toBeLessThanOrEqual(1.0001);
  });
});

describe('seat slots', () => {
  it('keeps bets and the dealer button inside the felt for 2..10 seats', () => {
    for (let n = 2; n <= 10; n++) {
      for (const slot of computeSeatSlots({ maxSeats: n })) {
        expect(Math.hypot(slot.betX, slot.betY)).toBeLessThan(1);
        expect(Math.hypot(slot.buttonX, slot.buttonY)).toBeLessThan(1);
      }
    }
  });
});

describe('chipBreakdown', () => {
  it('never exceeds the cap and always returns at least one chip', () => {
    expect(chipBreakdown(0, false)).toEqual([]);
    expect(chipBreakdown(1234567, false).length).toBeLessThanOrEqual(12);
    expect(chipBreakdown(0.01, true)).toEqual([1]);
  });
});

describe('readable ink (R16)', () => {
  it('passes AA 4.5:1 on every built-in felt and on extreme backgrounds', () => {
    const backgrounds = ['#1d6b3f', '#3a9a63', '#1a1a1d', '#f4f5f7', '#1e3f6d', '#403a34', '#ffffff', '#000000'];
    for (const bg of backgrounds) {
      expect(contrastRatio(readableInk(bg), bg), bg).toBeGreaterThanOrEqual(4.5);
    }
  });
});
