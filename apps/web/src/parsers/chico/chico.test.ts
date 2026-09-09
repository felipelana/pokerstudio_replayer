import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ChicoParser } from './index';
import { chicoConfidence, chicoSignatures } from './signature';
import { detectParser } from '../registry';
import { PokerStarsParser } from '../pokerstars';
import { buildReplay } from '@/engine/replay';
import type { Hand } from '@/model/types';

/**
 * Two real Chico tournaments from June 2026, 660 hands between them. The
 * grammar was derived from these files; they are the acceptance test.
 */
const parser = new ChicoParser();

const load = (file: string) => readFileSync(join(__dirname, 'fixtures', file), 'utf8');
const PKO = load('pko-916-1a5ca85-2026-06-14.txt');
const MAXIMIZER = load('maximizer-916-1a0d2ac-2026-06-08.txt');

const parseAll = (text: string): Hand[] =>
  parser.split(text).map((block, i) => ({ id: `c${i}`, ...parser.parse(block) }));

const pko = parseAll(PKO);
const maximizer = parseAll(MAXIMIZER);
const all = [...pko, ...maximizer];

/** Everything a seat put in, across every street. */
function contributed(hand: Hand): number {
  const streets = [hand.streets.preflop, hand.streets.flop ?? [], hand.streets.turn ?? [], hand.streets.river ?? []];
  let total = 0;
  for (const action of [...hand.posts, ...streets.flat(), ...hand.showdown]) {
    if (action.type === 'uncalled-return') total -= action.amount ?? 0;
    else if (['post-ante', 'post-sb', 'post-bb', 'post-straddle', 'post-dead', 'bet', 'call', 'raise'].includes(action.type)) {
      total += action.amount ?? 0;
    }
  }
  return Math.round(total);
}

describe('Chico: telling it apart from PokerStars', () => {
  it('never lets a Chico file be read as PokerStars', () => {
    // The header says PokerStars. Everything else says otherwise.
    expect(PKO.startsWith('PokerStars Hand #')).toBe(true);
    expect(new PokerStarsParser().detect(PKO)).toBe(0);
    expect(new PokerStarsParser().detect(MAXIMIZER)).toBe(0);
    expect(detectParser(PKO)?.parser.site).toBe('chico');
    expect(detectParser(MAXIMIZER)?.parser.site).toBe('chico');
  });

  it('is sure on the strength of several marks, not one', () => {
    expect(chicoConfidence(PKO)).toBeGreaterThanOrEqual(0.95);
    expect(chicoSignatures(PKO).length).toBeGreaterThanOrEqual(2);
    // A single mark on its own is a maybe, not a certainty.
    expect(chicoConfidence("Table 'CHC_1827491784 2' 8-max Seat #6 is the button")).toBe(0.5);
    expect(chicoConfidence('PokerStars Hand #1: Tournament #123, $5 USD')).toBe(0);
  });

  it('leaves a genuine PokerStars file to PokerStars', () => {
    const stars = readFileSync(join(__dirname, '..', 'pokerstars', 'fixtures', 'real-ko-tournament-dealer-export.txt'), 'utf8');
    expect(parser.detect(stars)).toBe(0);
    expect(detectParser(stars)?.parser.site).toBe('pokerstars');
  });
});

describe('Chico: the 660 real hands', () => {
  it('splits both files into every hand', () => {
    expect(pko).toHaveLength(401);
    expect(maximizer).toHaveLength(259);
  });

  it('parses all of them without a single warning, from the parser or the engine', () => {
    const problems: string[] = [];
    for (const hand of all) {
      for (const w of hand.warnings) problems.push(`#${hand.handNumber}: ${w}`);
      const replay = buildReplay(hand);
      for (const w of replay.warnings) if (!hand.warnings.includes(w)) problems.push(`#${hand.handNumber} engine: ${w}`);
    }
    expect(problems).toEqual([]);
  });

  it('balances every pot: what went in, less what came back, is what was declared', () => {
    const off = all
      .map((hand) => ({ hand: hand.handNumber, put: contributed(hand), declared: Math.round(hand.summary.totalPot) }))
      .filter((r) => r.put !== r.declared);
    expect(off).toEqual([]);
  });

  it('pays out exactly what the pot held, since the rake is zero in these tournaments', () => {
    const off = all
      .map((hand) => {
        const won = hand.summary.pots.flatMap((p) => p.winners).reduce((sum, w) => sum + w.amount, 0);
        return { hand: hand.handNumber, won: Math.round(won), pot: Math.round(hand.summary.totalPot - hand.summary.rake) };
      })
      .filter((r) => r.won !== r.pot);
    expect(off).toEqual([]);
    expect(all.every((h) => h.summary.rake === 0)).toBe(true);
  });

  it('reads the header Chico writes: a non-numeric tournament id and a level with no number', () => {
    expect(pko[0].gameType).toBe('tournament');
    expect(pko[0].tournament?.id).toBe('916-1a5ca85');
    expect(maximizer[0].tournament?.id).toBe('916-1a0d2ac');
    expect(pko[0].tournament?.level).toBeUndefined();
    // The ante is per player and lands in the blind structure.
    expect(pko[0].blinds).toEqual({ sb: 3500, bb: 7000, ante: 840 });
    expect(pko[0].currency).toBe('chips');
    expect(pko[0].tournament?.buyIn).toContain('33');
  });

  it('has no hero anywhere, which is what observer mode is for', () => {
    expect(all.every((h) => h.heroName === undefined)).toBe(true);
    expect(PKO.includes('Dealt to')).toBe(false);
    // Cards appear only where the room reveals them: at the showdown.
    const withCards = all.filter((h) => Object.keys(h.holeCards).length > 0);
    expect(withCards.length).toBeGreaterThan(100);
    for (const hand of withCards) {
      for (const name of Object.keys(hand.holeCards)) {
        expect(hand.showdown.some((a) => a.type === 'show' && a.player === name)).toBe(true);
      }
    }
  });

  it('collects the per-player ante rather than a single blind ante', () => {
    const first = pko[0];
    const antes = first.posts.filter((a) => a.type === 'post-ante');
    expect(antes).toHaveLength(first.players.length);
    expect(new Set(antes.map((a) => a.amount))).toEqual(new Set([840]));
  });

  it('reads a side pot written as "side pot-1"', () => {
    const withSide = all.find((h) => h.raw.includes('side pot-1'))!;
    expect(withSide).toBeDefined();
    expect(withSide.summary.pots.length).toBeGreaterThan(1);
    expect(withSide.summary.pots.some((p) => p.kind === 'side')).toBe(true);
  });

  it('reads a hand that ends before the flop, with an uncalled bet and no board', () => {
    const preflopOnly = pko.find((h) => !h.streets.flop && h.raw.includes('Uncalled bet'))!;
    expect(preflopOnly).toBeDefined();
    expect(preflopOnly.board).toEqual([]);
    expect(preflopOnly.showdown.filter((a) => a.type === 'show')).toHaveLength(0);
  });

  it('reads a showdown, its board and the winner', () => {
    const showdown = pko.find((h) => h.showdown.some((a) => a.type === 'show') && h.board.length === 5)!;
    expect(showdown.board).toHaveLength(5);
    const winners = showdown.summary.pots.flatMap((p) => p.winners);
    expect(winners.length).toBeGreaterThan(0);
    for (const w of winners) expect(showdown.players.some((p) => p.name === w.player)).toBe(true);
  });

  it('keeps seats that are not contiguous, on a table declared 8-max', () => {
    const gap = pko.find((h) => h.players.length < h.maxSeats)!;
    expect(gap.maxSeats).toBe(8);
    expect(gap.players.some((p) => p.seat > gap.players.length)).toBe(true);
    expect(gap.players.some((p) => p.seat === gap.buttonSeat)).toBe(true);
  });

  it('runs across several tables of the same tournament, in time order once sorted', () => {
    const tables = new Set(pko.map((h) => h.tableName));
    expect(tables.size).toBeGreaterThan(1);
    const sorted = [...pko].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].timestamp.getTime()).toBeGreaterThanOrEqual(sorted[i - 1].timestamp.getTime());
    }
    expect(sorted.every((h) => !Number.isNaN(h.timestamp.getTime()))).toBe(true);
  });

  it('marks every hand as Chico, whatever the header claims', () => {
    expect(all.every((h) => h.site === 'chico')).toBe(true);
  });
});
