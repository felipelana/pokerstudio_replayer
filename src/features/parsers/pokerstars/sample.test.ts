import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PokerStarsParser } from './index';
import { buildReplay, potOddsFor, quickResult } from '@/domain/engine/replay';
import type { Hand } from '@/domain/model/types';

const parser = new PokerStarsParser();
const text = readFileSync(
  join(__dirname, '..', '..', '..', 'lib', 'assets', 'samples', 'pokerstars-demo.txt'),
  'utf8',
);
const hands: Hand[] = parser.split(text).map((b, i) => ({ id: `s${i}`, ...parser.parse(b) }));

describe('samples/pokerstars-demo.txt', () => {
  it('has at least 15 hands, all with a hero', () => {
    expect(hands.length).toBeGreaterThanOrEqual(15);
    for (const h of hands) {
      expect(h.heroName).toBe('Hero');
      expect(h.holeCards.Hero).toHaveLength(2);
    }
  });

  it('parses and replays every hand without warnings', () => {
    for (const h of hands) {
      expect(h.warnings, `#${h.handNumber}`).toEqual([]);
      const r = buildReplay(h);
      expect(r.warnings, `#${h.handNumber}`).toEqual([]);
    }
  });

  it('covers every result colour and both game types', () => {
    const results = new Set(hands.map((h) => quickResult(h).result));
    expect(results).toEqual(new Set(['won', 'lost', 'folded', 'break-even']));
    expect(hands.some((h) => h.gameType === 'tournament' && h.blinds.ante)).toBe(true);
    expect(hands.some((h) => h.summary.pots.length > 1)).toBe(true);
  });

  it('pot odds match the manual calculation on 5 hands', () => {
    // Hand 1: villain raises to 0.30 (SB 0.05 + BB 0.10 in), hero to call 0.30 → pot 0.45 : 0.30 = 1.5:1, break-even 40%
    const h1 = buildReplay(hands[0]);
    const f1 = h1.frames.find(
      (f) => f.action?.type === 'raise' && f.action.player === 'villain one',
    )!;
    const o1 = potOddsFor(f1, 'Hero')!;
    expect(o1.toCall).toBeCloseTo(0.3);
    expect(o1.ratio).toBeCloseTo(0.45 / 0.3);
    expect(o1.breakEven).toBeCloseTo(0.3 / 0.75);

    // Hand 6: flop villain bets 0.40 into 0.65 → hero calls 0.40, pot 1.05 → 2.625:1, 27.6%
    const h6 = buildReplay(hands[5]);
    const f6 = h6.frames.find((f) => f.street === 'flop' && f.action?.type === 'bet')!;
    const o6 = potOddsFor(f6, 'Hero')!;
    expect(o6.toCall).toBeCloseTo(0.4);
    expect(o6.ratio).toBeCloseTo(1.05 / 0.4);

    // Hand 8: hero is the bettor → never facing a bet on any street.
    const h8 = buildReplay(hands[7]);
    for (const f of h8.frames)
      if (f.action?.player === 'Hero') expect(potOddsFor(f, 'Hero')).toBeUndefined();

    // Hand 11 (tournament): villain raises to 450 with 6 antes (150) + SB 100 + BB 200; hero to call 450.
    const h11 = buildReplay(hands[10]);
    const f11 = h11.frames.find((f) => f.action?.type === 'raise')!;
    const o11 = potOddsFor(f11, 'Hero')!;
    expect(o11.toCall).toBe(450);
    expect(o11.potAfterCall).toBe(150 + 100 + 200 + 450);
    expect(o11.breakEven).toBeCloseTo(450 / (900 + 450));

    // Hand 12: BB shoves 2050 over hero's 500 → hero to call 1550.
    const h12 = buildReplay(hands[11]);
    const f12 = h12.frames.find((f) => f.action?.isAllIn)!;
    const o12 = potOddsFor(f12, 'Hero')!;
    expect(o12.toCall).toBe(1550);
    expect(o12.potAfterCall).toBe(150 + 100 + 500 + 2050);
  });

  it('three-way all-in hand shows the right winner per pot', () => {
    const h7 = hands[6];
    expect(h7.summary.pots).toHaveLength(2);
    expect(h7.summary.pots[0].winners[0].player).toBe('Hero');
    expect(h7.summary.pots[1].winners[0].player).toBe('villain one');
    const r = buildReplay(h7);
    const end = r.frames[r.frames.length - 1];
    expect(end.players.find((p) => p.name === 'Hero')!.stack).toBeCloseTo(8.92);
  });
});
