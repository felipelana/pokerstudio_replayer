import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PokerStarsParser } from '@/features/parsers/pokerstars';
import type { Hand } from '@/domain/model/types';
import { buildReplay, computePots, potOddsFor, type Frame } from './replay';

const parser = new PokerStarsParser();
const fixture = (name: string) =>
  readFileSync(
    join(__dirname, '..', '..', 'features', 'parsers', 'pokerstars', 'fixtures', name),
    'utf8',
  );

function hands(name: string): Hand[] {
  return parser.split(fixture(name)).map((b, i) => ({ id: `h${i}`, ...parser.parse(b) }));
}

/** Invariant: at every frame, totalPot == sum(invested) - sum(collected), and stacks reconcile. */
function checkInvariants(frame: Frame, hand: Hand) {
  const invested = frame.players.reduce((s, p) => s + p.invested, 0);
  const collected = frame.players.reduce((s, p) => s + p.collected, 0);
  if (frame.kind !== 'end') expect(frame.totalPot).toBeCloseTo(invested - collected, 5);
  for (const p of frame.players) {
    const start = hand.players.find((x) => x.name === p.name)!.startingStack;
    expect(p.stack).toBeCloseTo(start - p.invested + p.collected, 5);
  }
}

describe('replay engine, KO tournament', () => {
  const [h1, h2, h3] = hands('synthetic-ko-tournament.txt');

  it('builds frames with invariants holding everywhere', () => {
    for (const h of [h1, h2, h3]) {
      const r = buildReplay(h);
      for (const f of r.frames) checkInvariants(f, h);
      expect(r.warnings).toEqual([]);
    }
  });

  it('starts with antes then blinds, and pot totals add up', () => {
    const r = buildReplay(h1);
    expect(r.frames[0].kind).toBe('start');
    expect(r.frames[0].totalPot).toBe(0);
    // 5 antes + SB + BB = 7 post frames, then deal-hole
    expect(r.frames.slice(1, 8).every((f) => f.kind === 'post')).toBe(true);
    expect(r.frames[8].kind).toBe('deal-hole');
    expect(r.frames[8].totalPot).toBe(7500 + 5000 + 10000);
    expect(r.frames[8].pot).toBe(7500); // antes in the middle, blinds in front
  });

  it('marks all-in and handles uncalled return', () => {
    const r = buildReplay(h1);
    const afterRaise = r.frames.find((f) => f.action?.type === 'raise')!;
    expect(afterRaise.players.find((p) => p.name === 'Saludfresh')?.allIn).toBe(true);
    expect(afterRaise.players.find((p) => p.name === 'Saludfresh')?.stack).toBe(
      215283 - 1500 - 122266,
    );
    const afterReturn = r.frames.find((f) => f.kind === 'uncalled')!;
    const s = afterReturn.players.find((p) => p.name === 'Saludfresh')!;
    expect(s.streetBet).toBe(43620);
    expect(s.allIn).toBe(false);
    expect(afterReturn.totalPot).toBe(109740);
  });

  it('reveals cards at showdown and pays the winner', () => {
    const r = buildReplay(h1);
    const show = r.frames.find((f) => f.kind === 'show')!;
    expect(show.players.find((p) => p.name === 'Saludfresh')?.cards).toEqual(['Qs', 'Ac']);
    const end = r.frames[r.frames.length - 1];
    expect(end.kind).toBe('end');
    expect(end.players.find((p) => p.name === 'Saludfresh')?.stack).toBe(279903);
    expect(end.players.find((p) => p.name === 'WBreKoZo')?.stack).toBe(0);
    expect(end.totalPot).toBe(0);
  });

  it('exposes street start indices and board progression', () => {
    const r = buildReplay(h1);
    expect(r.streetStart.preflop).toBe(0);
    expect(r.frames[r.streetStart.flop!].board).toHaveLength(3);
    expect(r.frames[r.streetStart.turn!].board).toHaveLength(4);
    expect(r.frames[r.streetStart.river!].board).toHaveLength(5);
    expect(r.frames[r.streetStart.flop! - 1].board).toHaveLength(0);
  });

  it('computes main and side pots for a 3-way all-in', () => {
    const r = buildReplay(h2);
    const flopCall = r.frames.find((f) => f.street === 'flop' && f.action?.type === 'call')!;
    expect(flopCall.pots.map((p) => [p.kind, p.amount])).toEqual([
      ['main', 246530],
      ['side', 66980],
    ]);
    expect(flopCall.pots[0].eligible.sort()).toEqual(
      ['-Iuury', 'Player Four', 'Saludfresh'].sort(),
    );
    expect(flopCall.pots[1].eligible.sort()).toEqual(['Player Four', 'Saludfresh'].sort());
    const end = r.frames[r.frames.length - 1];
    expect(end.players.find((p) => p.name === 'Saludfresh')?.stack).toBe(479913);
  });

  it('flags eliminated players as all-in and treats sitting-out non-participants as out of hand', () => {
    const r = buildReplay(h2);
    const end = r.frames[r.frames.length - 1];
    const shogi = end.players.find((p) => p.name === 'shogi2')!;
    expect(shogi.inHand).toBe(true); // posted ante/SB, so dealt in
    expect(shogi.folded).toBe(true);
  });

  it('supports a focus player override for hero-less hands', () => {
    const r = buildReplay(h1, 'Saludfresh');
    expect(r.heroResult).toBe('won');
    expect(r.heroNet).toBe(279903 - 215283);
    expect(r.heroVpip).toBe(true);
    expect(r.heroFirstAction).toBeDefined();
    expect(r.frames[r.heroFirstAction!].actingPlayer).toBe('Saludfresh');
    const loser = buildReplay(h1, 'WBreKoZo');
    expect(loser.heroResult).toBe('lost');
    const folder = buildReplay(h1, '-Iuury');
    expect(folder.heroResult).toBe('folded');
  });
});

describe('replay engine, cash', () => {
  const [c1, c2, c3] = hands('synthetic-cash.txt');

  it('holds invariants and reconciles rake', () => {
    for (const h of [c1, c2, c3]) {
      const r = buildReplay(h);
      for (const f of r.frames) checkInvariants(f, h);
      expect(r.warnings).toEqual([]);
    }
  });

  it('shows hero cards at deal-hole and villain cards only at showdown', () => {
    const r = buildReplay(c1);
    const deal = r.frames.find((f) => f.kind === 'deal-hole')!;
    expect(deal.players.find((p) => p.name === 'Hero')?.cards).toEqual(['Ah', 'Kd']);
    expect(deal.players.find((p) => p.name === 'villain one')?.cards).toBeUndefined();
    const show = r.frames.find((f) => f.kind === 'show')!;
    expect(show.players.find((p) => p.name === 'villain one')?.cards).toEqual(['7s', '7h']);
  });

  it('computes hero result and net', () => {
    expect(buildReplay(c1).heroResult).toBe('lost');
    expect(buildReplay(c1).heroNet).toBeCloseTo(-10.5);
    expect(buildReplay(c2).heroResult).toBe('lost');
    expect(buildReplay(c3).heroResult).toBe('folded');
    expect(buildReplay(c3).heroVpip).toBe(false);
  });

  it('computes pot odds when the hero faces a bet', () => {
    const r = buildReplay(c1);
    // Frame after villain's flop check-raise to 3.60: hero has 1.20 in, must call 2.40.
    const f = r.frames.find((f) => f.street === 'flop' && f.action?.type === 'raise')!;
    const odds = potOddsFor(f, 'Hero')!;
    expect(odds.toCall).toBeCloseTo(2.4);
    // Pot: 2.15 preflop + 1.20 + 3.60 = 6.95
    expect(odds.potAfterCall).toBeCloseTo(6.95);
    expect(odds.ratio).toBeCloseTo(6.95 / 2.4);
    expect(odds.breakEven).toBeCloseTo(2.4 / (6.95 + 2.4));
    // When not facing a bet: undefined
    const deal = r.frames.find((x) => x.kind === 'deal-street')!;
    expect(potOddsFor(deal, 'Hero')).toBeUndefined();
  });

  it('actingPlayer looks ahead to the next betting action', () => {
    const r = buildReplay(c1);
    const deal = r.frames.find((f) => f.kind === 'deal-hole')!;
    expect(deal.actingPlayer).toBe('Иван');
    const end = r.frames[r.frames.length - 1];
    expect(end.actingPlayer).toBeUndefined();
  });

  it('dead blind goes to the pot, live blind stays in front', () => {
    const r = buildReplay(c3);
    const deal = r.frames.find((f) => f.kind === 'deal-hole')!;
    expect(deal.pot).toBeCloseTo(0.05);
    expect(deal.players.find((p) => p.name === 'Hero')?.streetBet).toBeCloseTo(0.1);
  });
});

describe('computePots', () => {
  it('returns [] without an all-in', () => {
    expect(
      computePots([
        {
          name: 'a',
          seat: 1,
          stack: 10,
          streetBet: 5,
          invested: 5,
          folded: false,
          allIn: false,
          inHand: true,
          dealt: true,
          sittingOut: false,
          revealed: false,
          collected: 0,
        },
      ]),
    ).toEqual([]);
  });
});

describe('all-in showdown (R9)', () => {
  const allInHand = `PokerStars Hand #900000001: Tournament #999, $10+$1 USD Hold'em No Limit - Level V (75/150) - 2024/03/01 20:15:33 ET
Table '999 1' 6-max Seat #1 is the button
Seat 1: Hero (1500 in chips)
Seat 2: Villain (1500 in chips)
Hero: posts small blind 75
Villain: posts big blind 150
*** HOLE CARDS ***
Dealt to Hero [Ah As]
Hero: raises 1350 to 1500 and is all-in
Villain: calls 1350 and is all-in
*** FLOP *** [2c 7d 9h]
*** TURN *** [2c 7d 9h] [3s]
*** RIVER *** [2c 7d 9h 3s] [4c]
*** SHOW DOWN ***
Hero: shows [Ah As] (a pair of Aces)
Villain: shows [Kh Kd] (a pair of Kings)
Hero collected 3000 from pot
*** SUMMARY ***
Total pot 3000 | Rake 0
Board [2c 7d 9h 3s 4c]
Seat 1: Hero (button) (small blind) showed [Ah As] and won (3000) with a pair of Aces
Seat 2: Villain (big blind) showed [Kh Kd] and lost with a pair of Kings
`;

  it('turns both hands face up at the all-in, not at the river', () => {
    const hand = { ...new PokerStarsParser().parse(allInHand), id: 't1' } as Hand;
    const replay = buildReplay(hand, 'Hero');
    const callIndex = replay.frames.findIndex(
      (f) => f.action?.type === 'call' && f.action.player === 'Villain',
    );
    expect(callIndex).toBeGreaterThan(0);

    const atAllIn = replay.frames[callIndex];
    expect(atAllIn.board).toHaveLength(0);
    const villain = atAllIn.players.find((p) => p.name === 'Villain')!;
    expect(villain.revealed).toBe(true);
    expect(villain.cards).toEqual(['Kh', 'Kd']);

    // And they stay up while the board runs out.
    const flop = replay.frames.find((f) => f.street === 'flop')!;
    expect(flop.players.find((p) => p.name === 'Villain')!.revealed).toBe(true);
  });

  it('keeps unknown hands face down', () => {
    const hidden = allInHand
      .replace('Villain: shows [Kh Kd] (a pair of Kings)\n', '')
      .replace(
        'Seat 2: Villain (big blind) showed [Kh Kd] and lost with a pair of Kings',
        'Seat 2: Villain (big blind) mucked',
      );
    const replay = buildReplay(
      { ...new PokerStarsParser().parse(hidden), id: 't2' } as Hand,
      'Hero',
    );
    const callIndex = replay.frames.findIndex(
      (f) => f.action?.type === 'call' && f.action.player === 'Villain',
    );
    expect(replay.frames[callIndex].players.find((p) => p.name === 'Villain')!.revealed).toBe(
      false,
    );
  });
});
