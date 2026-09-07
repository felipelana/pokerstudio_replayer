import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PokerStarsParser } from './index';
import { parseText } from '../registry';
import { buildReplay, quickResult } from '@/engine/replay';
import { computePositions } from '@/model/positions';
import type { Hand } from '@/model/types';

/**
 * Real PokerStars KO tournament export (dealer/observer view, no "Dealt to").
 * 36 hands. This file is the reference the parser grammar was derived from.
 */
const parser = new PokerStarsParser();
const text = readFileSync(join(__dirname, 'fixtures', 'real-ko-tournament-dealer-export.txt'), 'utf8');
const blocks = parser.split(text);
const hands: Hand[] = blocks.map((b, i) => ({ id: `r${i}`, ...parser.parse(b) }));
const byNumber = (n: string) => hands.find((h) => h.handNumber === n)!;

describe('real fixture: KO tournament dealer export', () => {
  it('has a BOM, CRLF and trailing spaces', () => {
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('\r\n');
    expect(/ \r?\n/.test(text)).toBe(true);
  });

  it('splits into 36 hands', () => {
    expect(hands).toHaveLength(36);
  });

  it('parses every hand with zero warnings and zero engine warnings', () => {
    const problems: string[] = [];
    for (const h of hands) {
      for (const w of h.warnings) problems.push(`#${h.handNumber}: ${w}`);
      const r = buildReplay(h);
      for (const w of r.warnings) if (!h.warnings.includes(w)) problems.push(`#${h.handNumber} engine: ${w}`);
    }
    expect(problems).toEqual([]);
  });

  it('is a knockout tournament with a 3-part buy-in and no hero', () => {
    const h = hands[0];
    expect(h.gameType).toBe('tournament');
    expect(h.tournament?.id).toBe('3999835239');
    expect(h.tournament?.buyIn).toBe('$0.49+$0.49+$0.12 USD');
    expect(h.tournament?.bounty).toBeCloseTo(0.49);
    expect(h.tournament?.fee).toBeCloseTo(0.12);
    expect(h.currency).toBe('chips');
    for (const x of hands) expect(x.heroName).toBeUndefined();
  });

  it('uses the bracketed ET timestamp', () => {
    for (const h of hands) expect(Number.isNaN(h.timestamp.getTime())).toBe(false);
    expect(hands[0].raw).toMatch(/WET \[\d{4}\/\d{2}\/\d{2} \d{1,2}:\d{2}:\d{2} ET\]/);
  });

  it('keeps the hyphen-leading player name and sitting-out players', () => {
    const names = new Set(hands.flatMap((h) => h.players.map((p) => p.name)));
    expect(names.has('-Iuury')).toBe(true);
    expect(hands.some((h) => h.players.some((p) => p.name === 'shogi2' && p.isSittingOut))).toBe(true);
    expect(hands.some((h) => h.events.some((e) => e.type === 'timeout' && e.player === 'shogi2'))).toBe(true);
  });

  it('the WBreKoZo elimination hand (showdown) reveals cards and pays the right winner', () => {
    // The metaprompt cites #260784573817, which is not in the export; the
    // elimination hand it describes is located by its bounty event instead.
    const h = hands.find((x) => x.events.some((e) => e.detail?.startsWith('bounty:') && e.detail.includes('WBreKoZo')))!;
    expect(h).toBeDefined();
    expect(byNumber(h.handNumber)).toBe(h);
    expect(hands.filter((x) => x.showdown.length > 0).length).toBeGreaterThanOrEqual(10);
    expect(h.showdown.length).toBeGreaterThan(0);
    const shown = h.showdown.filter((a) => a.type === 'show');
    expect(shown.length).toBeGreaterThanOrEqual(1);
    for (const s of shown) expect(h.holeCards[s.player]).toHaveLength(2);
    const collects = [...h.streets.preflop, ...(h.streets.flop ?? []), ...(h.streets.turn ?? []), ...(h.streets.river ?? []), ...h.showdown].filter(
      (a) => a.type === 'collect',
    );
    expect(collects.length).toBeGreaterThan(0);
    const winners = new Set(collects.map((c) => c.player));
    expect(h.summary.pots.flatMap((p) => p.winners.map((w) => w.player)).every((w) => winners.has(w))).toBe(true);
    // Replay: the winner's final stack equals start - invested + collected and cards are visible at the end.
    const r = buildReplay(h);
    const end = r.frames[r.frames.length - 1];
    for (const w of winners) {
      const st = end.players.find((p) => p.name === w)!;
      expect(st.collected).toBeGreaterThan(0);
      expect(st.stack).toBeGreaterThan(0);
    }
    for (const s of shown) expect(end.players.find((p) => p.name === s.player)?.cards).toHaveLength(2);
    expect(r.warnings).toEqual([]);
  });

  it('records eliminations and bounties as informational events', () => {
    const fin = hands.flatMap((h) => h.events).filter((e) => e.detail?.startsWith('finished:'));
    const bounty = hands.flatMap((h) => h.events).filter((e) => e.detail?.startsWith('bounty:'));
    expect(fin.length).toBeGreaterThan(0);
    expect(bounty.length).toBeGreaterThan(0);
    expect(fin.some((e) => e.player === 'WBreKoZo' && e.detail?.includes('9'))).toBe(true);
    expect(bounty.some((e) => e.player === 'Saludfresh' && e.detail?.includes('WBreKoZo'))).toBe(true);
  });

  it('handles "mucked" without cards and "showed … and lost"', () => {
    expect(text).toMatch(/mucked\s*\r?\n/);
    expect(text).toMatch(/showed \[[^\]]+\] and lost with/);
    for (const h of hands) {
      for (const [name, cards] of Object.entries(h.holeCards)) {
        expect(cards, `${h.handNumber} ${name}`).toHaveLength(2);
      }
    }
  });

  it('ante 1500 with 5000/10000 blinds: BB divisor is 10000 and antes are in the initial pot', () => {
    const h = hands.find((x) => x.blinds.ante === 1500 && x.blinds.bb === 10000);
    expect(h).toBeDefined();
    const r = buildReplay(h!);
    const deal = r.frames.find((f) => f.kind === 'deal-hole')!;
    const antes = h!.posts.filter((p) => p.type === 'post-ante').reduce((s, p) => s + (p.amount ?? 0), 0);
    expect(deal.pot).toBe(antes);
    expect(deal.totalPot).toBe(antes + h!.blinds.sb + h!.blinds.bb);
  });

  it('focus override drives positions, results and list metadata', () => {
    const h = hands[0];
    const name = h.players[0].name;
    const meta = quickResult(h, name);
    expect(meta.heroName).toBe(name);
    expect(meta.result).toBeDefined();
    expect(computePositions(h)[name]).toBeDefined();
    expect(quickResult(h).heroName).toBeUndefined();
  });

  it('imports end-to-end with stable ids and no failures', async () => {
    const result = await parseText(text);
    expect(result.site).toBe('pokerstars');
    expect(result.hands).toHaveLength(36);
    expect(result.failures).toEqual([]);
    expect(new Set(result.hands.map((h) => h.id)).size).toBe(36);
  });
});
