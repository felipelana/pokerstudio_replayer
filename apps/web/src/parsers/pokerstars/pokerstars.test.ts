import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PokerStarsParser, parseBuyIn, parseTimestamp } from './index';
import { parseText, detectParser } from '../registry';

const parser = new PokerStarsParser();
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

const ko = fixture('synthetic-ko-tournament.txt');
const cash = fixture('synthetic-cash.txt');

describe('PokerStars detect/split', () => {
  it('detects PokerStars with full confidence', () => {
    expect(parser.detect(ko)).toBe(1);
    expect(parser.detect(cash)).toBe(1);
    expect(detectParser(ko)?.parser.site).toBe('pokerstars');
  });

  it('does not detect random text', () => {
    expect(parser.detect('hello world')).toBe(0);
  });

  it('splits on headers regardless of blank-line count', () => {
    expect(parser.split(ko)).toHaveLength(3);
    expect(parser.split(cash)).toHaveLength(3);
  });

  it('tolerates BOM and CRLF', () => {
    const crlf = '﻿' + cash.replace(/\n/g, '\r\n');
    const blocks = parser.split(crlf);
    expect(blocks).toHaveLength(3);
    const hand = parser.parse(blocks[0]);
    expect(hand.handNumber).toBe('245000000001');
    expect(hand.warnings).toEqual([]);
  });
});

describe('PokerStars tournament header', () => {
  const hand = parser.parse(parser.split(ko)[0]);

  it('parses hand number, tournament id and 3-part KO buy-in', () => {
    expect(hand.handNumber).toBe('260784573801');
    expect(hand.gameType).toBe('tournament');
    expect(hand.tournament?.id).toBe('3999835239');
    expect(hand.tournament?.buyInMain).toBeCloseTo(0.49);
    expect(hand.tournament?.bounty).toBeCloseTo(0.49);
    expect(hand.tournament?.fee).toBeCloseTo(0.12);
    expect(hand.tournament?.buyInCurrency).toBe('USD');
    expect(hand.tournament?.level).toBe('XX');
  });

  it('parses blinds and ante', () => {
    expect(hand.blinds).toEqual({ sb: 5000, bb: 10000, ante: 1500 });
    expect(hand.currency).toBe('chips');
  });

  it('uses the bracketed ET timestamp as reference', () => {
    // 2026/05/12 15:39:36 ET (EDT, UTC-4) => 19:39:36Z
    expect(hand.timestamp.toISOString()).toBe('2026-05-12T19:39:36.000Z');
  });

  it('parses table, max seats and button', () => {
    expect(hand.tableName).toBe('3999835239 12');
    expect(hand.maxSeats).toBe(9);
    expect(hand.buttonSeat).toBe(3);
  });

  it('has no hero (dealer export without "Dealt to")', () => {
    expect(hand.heroName).toBeUndefined();
    expect(hand.players.every((p) => !p.isHero)).toBe(true);
  });

  it('parses seats incl. leading-hyphen names and sitting out', () => {
    expect(hand.players.map((p) => p.name)).toEqual([
      '-Iuury',
      'Saludfresh',
      'WBreKoZo',
      'Player Four',
      'shogi2',
    ]);
    expect(hand.players.find((p) => p.name === 'shogi2')?.isSittingOut).toBe(true);
    expect(hand.players.find((p) => p.name === '-Iuury')?.startingStack).toBe(81510);
  });

  it('parses antes and blinds as posts', () => {
    expect(hand.posts.filter((p) => p.type === 'post-ante')).toHaveLength(5);
    expect(hand.posts.find((p) => p.type === 'post-sb')?.player).toBe('Player Four');
    expect(hand.posts.find((p) => p.type === 'post-bb')?.amount).toBe(10000);
  });

  it('parses raise-to all-in with incremental amount', () => {
    const raise = hand.streets.preflop.find((a) => a.type === 'raise')!;
    expect(raise.player).toBe('Saludfresh');
    expect(raise.toAmount).toBe(122266);
    expect(raise.amount).toBe(122266);
    expect(raise.isAllIn).toBe(true);
    const call = hand.streets.preflop.find((a) => a.type === 'call')!;
    expect(call.amount).toBe(43620);
    expect(call.isAllIn).toBe(true);
  });

  it('parses uncalled bet return', () => {
    const u = hand.streets.preflop.find((a) => a.type === 'uncalled-return')!;
    expect(u.player).toBe('Saludfresh');
    expect(u.amount).toBe(78646);
  });

  it('parses board from street markers', () => {
    expect(hand.board).toEqual(['6s', '7c', '9s', 'Td', '2h']);
    expect(hand.streets.flop).toEqual([]);
    expect(hand.streets.turn).toEqual([]);
    expect(hand.streets.river).toEqual([]);
  });

  it('parses showdown: shows, muck without cards, collect', () => {
    expect(hand.holeCards['Saludfresh']).toEqual(['Qs', 'Ac']);
    expect(hand.holeCards['WBreKoZo']).toBeUndefined();
    const collect = hand.showdown.find((a) => a.type === 'collect')!;
    expect(collect.amount).toBe(109740);
    expect(hand.showdown.find((a) => a.type === 'muck')?.player).toBe('WBreKoZo');
  });

  it('records timeout and bounty/elimination as events', () => {
    expect(hand.events.some((e) => e.type === 'timeout' && e.player === 'shogi2')).toBe(true);
    const bounty = hand.events.find((e) => e.detail?.startsWith('bounty:'));
    expect(bounty?.player).toBe('Saludfresh');
    expect(bounty?.amount).toBeCloseTo(2.15);
    const fin = hand.events.find((e) => e.detail?.startsWith('finished:'));
    expect(fin?.player).toBe('WBreKoZo');
    expect(fin?.detail).toBe('finished:9:$3.67');
  });

  it('parses summary pot and winners', () => {
    expect(hand.summary.totalPot).toBe(109740);
    expect(hand.summary.rake).toBe(0);
    expect(hand.summary.pots).toHaveLength(1);
    expect(hand.summary.pots[0].winners).toEqual([{ player: 'Saludfresh', amount: 109740 }]);
  });

  it('produces no warnings on the KO fixture', () => {
    for (const block of parser.split(ko)) {
      expect(parser.parse(block).warnings).toEqual([]);
    }
  });
});

describe('PokerStars multi all-in with side pot', () => {
  const hand = parser.parse(parser.split(ko)[1]);

  it('splits main and side pots with winners', () => {
    expect(hand.summary.totalPot).toBe(313510);
    expect(hand.summary.pots.map((p) => [p.kind, p.amount])).toEqual([
      ['main', 246530],
      ['side', 66980],
    ]);
    expect(hand.summary.pots[0].winners).toEqual([{ player: 'Saludfresh', amount: 246530 }]);
    expect(hand.summary.pots[1].winners).toEqual([{ player: 'Saludfresh', amount: 66980 }]);
  });

  it('computes incremental raise amounts across a 3-bet', () => {
    const pre = hand.streets.preflop;
    const r1 = pre.find((a) => a.type === 'raise' && a.player === 'Saludfresh')!;
    expect(r1.amount).toBe(20000);
    const r2 = pre.find((a) => a.type === 'raise' && a.player === '-Iuury')!;
    expect(r2.toAmount).toBe(78510);
    expect(r2.amount).toBe(68510); // had 10000 BB posted
  });

  it('recovers all shown cards', () => {
    expect(hand.holeCards).toEqual({
      Saludfresh: ['Ks', 'Kd'],
      'Player Four': ['Ah', '4s'],
      '-Iuury': ['Qs', 'Qd'],
    });
  });

  it('keeps "is sitting out" / "has returned" as info events', () => {
    expect(hand.events.filter((e) => e.type === 'info' && e.player === 'shogi2')).toHaveLength(2);
    expect(hand.warnings).toEqual([]);
  });
});

describe('PokerStars walk / doesn\'t show', () => {
  const hand = parser.parse(parser.split(ko)[2]);
  it('handles heads-up with uncalled return and no showdown section', () => {
    expect(hand.streets.preflop.map((a) => a.type)).toEqual([
      'raise',
      'fold',
      'uncalled-return',
      'collect',
      'muck',
    ]);
    expect(hand.summary.pots[0].winners).toEqual([{ player: 'shogi2', amount: 23000 }]);
    expect(hand.warnings).toEqual([]);
  });
});

describe('PokerStars cash game', () => {
  const hands = parser.split(cash).map((b) => parser.parse(b));

  it('parses cash header with currency', () => {
    const h = hands[0];
    expect(h.gameType).toBe('cash');
    expect(h.currency).toBe('USD');
    expect(h.blinds).toEqual({ sb: 0.05, bb: 0.1 });
    expect(h.timestamp.toISOString()).toBe('2024-03-02T01:15:33.000Z'); // EST, UTC-5
    expect(h.tableName).toBe('Aludra II');
    expect(h.maxSeats).toBe(6);
  });

  it('identifies the hero from Dealt to', () => {
    expect(hands[0].heroName).toBe('Hero');
    expect(hands[0].holeCards['Hero']).toEqual(['Ah', 'Kd']);
    expect(hands[0].players.find((p) => p.name === 'Hero')?.isHero).toBe(true);
  });

  it('parses names with spaces, parentheses, brackets and non-ASCII', () => {
    expect(hands[0].players.map((p) => p.name)).toEqual([
      'villain one',
      'Hero',
      'José (Ñu) [x]',
      '김철수',
      'sitter',
      'Иван',
    ]);
    expect(hands[0].players.find((p) => p.name === 'José (Ñu) [x]')?.startingStack).toBeCloseTo(9.85);
  });

  it('parses dollar amounts and rake', () => {
    expect(hands[0].summary.totalPot).toBeCloseTo(21.15);
    expect(hands[0].summary.rake).toBeCloseTo(0.95);
    const turnBet = hands[0].streets.turn![0];
    expect(turnBet.amount).toBeCloseTo(5.9);
    expect(turnBet.isAllIn).toBe(true);
  });

  it('recovers mucked cards from summary', () => {
    expect(hands[0].holeCards['Hero']).toEqual(['Ah', 'Kd']);
    expect(hands[1].holeCards['José (Ñu) [x]']).toEqual(['Ad', 'Kd']);
  });

  it('parses "posts small & big blinds" as dead + live', () => {
    const posts = hands[2].posts.filter((p) => p.player === 'Hero');
    expect(posts.map((p) => [p.type, p.amount])).toEqual([
      ['post-dead', 0.05],
      ['post-bb', 0.1],
    ]);
  });

  it('parses folded-on-flop summary lines and collected', () => {
    expect(hands[2].summary.pots[0].winners).toEqual([{ player: '김철수', amount: 0.78 }]);
    expect(hands[2].board).toEqual(['Js', 'Jd', '4h']);
  });

  it('produces no warnings on the cash fixture', () => {
    for (const h of hands) expect(h.warnings).toEqual([]);
  });
});

describe('PokerStars edge cases', () => {
  it('parses Zoom header and play money', () => {
    const text = `PokerStars Zoom Hand #100:  Hold'em No Limit (1000/2000) - 2024/01/01 10:00:00 ET
Table 'Halley' 6-max Seat #1 is the button
Seat 1: A (100000 in chips)
Seat 2: B (100000 in chips)
A: posts small blind 1000
B: posts big blind 2000
*** HOLE CARDS ***
A: folds
Uncalled bet (1000) returned to B
B collected 2000 from pot
B: doesn't show hand
*** SUMMARY ***
Total pot 2000 | Rake 0
Seat 1: A (button) (small blind) folded before Flop
Seat 2: B (big blind) collected (2000)`;
    const h = parser.parse(text);
    expect(h.currency).toBe('PLAY');
    expect(h.handNumber).toBe('100');
    expect(h.warnings).toEqual([]);
  });

  it('parses EUR cash and 2-part tournament buy-in', () => {
    const h = parser.parse(
      `PokerStars Hand #1:  Hold'em No Limit (€0.02/€0.05 EUR) - 2024/06/15 12:00:00 CET [2024/06/15 6:00:00 ET]\nTable 'X' 9-max Seat #1 is the button\nSeat 1: A (€5 in chips)\n*** SUMMARY ***\nTotal pot €0 | Rake €0`,
    );
    expect(h.currency).toBe('EUR');
    expect(h.blinds).toEqual({ sb: 0.02, bb: 0.05 });
    expect(parseBuyIn('$3.32+$0.18 USD')).toMatchObject({ buyInMain: 3.32, fee: 0.18 });
    expect(parseBuyIn('Freeroll')).toMatchObject({ isFreeroll: true });
  });

  it('parses straddle and thousand separators', () => {
    const text = `PokerStars Hand #2:  Hold'em No Limit ($1/$2 USD) - 2024/06/15 12:00:00 ET
Table 'Y' 6-max Seat #1 is the button
Seat 1: A ($1,500.50 in chips)
Seat 2: B ($2,000 in chips)
Seat 3: C ($3,000 in chips)
B: posts small blind $1
C: posts big blind $2
A: posts straddle $4
*** HOLE CARDS ***
B: folds
C: folds
Uncalled bet ($2) returned to A
A collected $5 from pot
*** SUMMARY ***
Total pot $5 | Rake $0
Seat 1: A (button) collected ($5)
Seat 2: B (small blind) folded before Flop
Seat 3: C (big blind) folded before Flop`;
    const h = parser.parse(text);
    expect(h.players[0].startingStack).toBe(1500.5);
    expect(h.players[1].startingStack).toBe(2000);
    expect(h.blinds.straddle).toBe(4);
    expect(h.posts.find((p) => p.type === 'post-straddle')?.amount).toBe(4);
    expect(h.warnings).toEqual([]);
  });

  it('flags Run It Twice with a warning and keeps the first board', () => {
    const text = `PokerStars Hand #3:  Hold'em No Limit ($1/$2 USD) - 2024/06/15 12:00:00 ET
Table 'Z' 6-max Seat #1 is the button
Seat 1: A ($100 in chips)
Seat 2: B ($100 in chips)
A: posts small blind $1
B: posts big blind $2
*** HOLE CARDS ***
A: raises $98 to $100 and is all-in
B: calls $98 and is all-in
Hand was run twice
*** FIRST FLOP *** [Ah Kh Qh]
*** FIRST TURN *** [Ah Kh Qh] [2c]
*** FIRST RIVER *** [Ah Kh Qh 2c] [3d]
*** SECOND FLOP *** [2s 3s 4s]
*** SECOND TURN *** [2s 3s 4s] [5c]
*** SECOND RIVER *** [2s 3s 4s 5c] [9d]
*** FIRST SHOW DOWN ***
A: shows [Jh Th] (a Royal Flush)
B: shows [Ac Ad] (three of a kind, Aces)
A collected $99 from pot
*** SECOND SHOW DOWN ***
B: shows [Ac Ad] (a pair of Aces)
A: shows [Jh Th] (high card Ace)
B collected $99 from pot
*** SUMMARY ***
Total pot $200 | Rake $2
Hand was run twice
FIRST Board [Ah Kh Qh 2c 3d]
SECOND Board [2s 3s 4s 5c 9d]
Seat 1: A (button) (small blind) showed [Jh Th] and won ($99) with a Royal Flush, and lost with high card Ace
Seat 2: B (big blind) showed [Ac Ad] and lost with three of a kind, Aces, and won ($99) with a pair of Aces`;
    const h = parser.parse(text);
    expect(h.warnings.some((w) => /Run It Twice/.test(w))).toBe(true);
    expect(h.board).toEqual(['Ah', 'Kh', 'Qh', '2c', '3d']);
    expect(h.holeCards['A']).toEqual(['Jh', 'Th']);
  });

  it('pushes unknown lines to warnings instead of throwing', () => {
    const text = `PokerStars Hand #4:  Hold'em No Limit ($1/$2 USD) - 2024/06/15 12:00:00 ET
Table 'Z' 6-max Seat #1 is the button
Seat 1: A ($100 in chips)
Seat 2: B ($100 in chips)
A: posts small blind $1
B: posts big blind $2
Something completely unexpected happened here
*** HOLE CARDS ***
A: folds
Uncalled bet ($1) returned to B
B collected $2 from pot
*** SUMMARY ***
Total pot $2 | Rake $0
Seat 2: B (big blind) collected ($2)`;
    const h = parser.parse(text);
    expect(h.warnings).toHaveLength(1);
    expect(h.warnings[0]).toMatch(/Unrecognised line/);
    expect(h.streets.preflop).toHaveLength(3);
  });

  it('handles chat, joins/leaves, disconnects and "out of hand"', () => {
    const text = `PokerStars Hand #5:  Hold'em No Limit ($1/$2 USD) - 2024/06/15 12:00:00 ET
Table 'Z' 6-max Seat #1 is the button
Seat 1: A ($100 in chips)
Seat 2: B ($100 in chips)
Seat 3: C ($50 in chips) out of hand (moved from another table into small blind)
A: posts small blind $1
B: posts big blind $2
B said, "gg: nice"
A is disconnected
A is connected
D joins the table at seat #4
C will be allowed to play after the button
*** HOLE CARDS ***
A: folds
Uncalled bet ($1) returned to B
B collected $2 from pot
E leaves the table
*** SUMMARY ***
Total pot $2 | Rake $0
Seat 2: B (big blind) collected ($2)`;
    const h = parser.parse(text);
    expect(h.warnings).toEqual([]);
    expect(h.players[2].isSittingOut).toBe(true);
    expect(h.events.filter((e) => e.type === 'disconnect')).toHaveLength(2);
  });

  it('parseTimestamp handles ET DST and bracket precedence', () => {
    expect(parseTimestamp('2024/07/01 12:00:00 ET').toISOString()).toBe('2024-07-01T16:00:00.000Z');
    expect(parseTimestamp('2024/01/01 12:00:00 ET').toISOString()).toBe('2024-01-01T17:00:00.000Z');
    expect(parseTimestamp('2024/01/01 18:00:00 CET [2024/01/01 12:00:00 ET]').toISOString()).toBe(
      '2024-01-01T17:00:00.000Z',
    );
  });
});

describe('registry parseText', () => {
  it('parses a file end-to-end with stable ids', async () => {
    const a = await parseText(ko);
    // The fixture reaches the disk with whatever line ending git was told to
    // write, so it is flattened to LF before the Windows file is simulated.
    // Without that, a CRLF checkout doubles every line and the blocks split
    // differently, which changes the hand ids.
    const windowsFile = ko.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    const b = await parseText('\uFEFF' + windowsFile);
    expect(a.site).toBe('pokerstars');
    expect(a.hands).toHaveLength(3);
    expect(a.hands.map((h) => h.id)).toEqual(b.hands.map((h) => h.id));
    expect(a.failures).toEqual([]);
  });

  it('reports unsupported-but-recognised formats', async () => {
    const r = await parseText('Game Hand #123 - Tournament #1 - Holdem(No Limit) - Level 1 (10.00/20.00)\nTable x\n');
    expect(r.site).toBe('wpn');
    expect(r.hands).toHaveLength(0);
    expect(r.warnings[0]).toMatch(/not implemented/);
  });

  it('returns unknown for unrecognised text', async () => {
    const r = await parseText('nothing to see here');
    expect(r.site).toBe('unknown');
  });
});
