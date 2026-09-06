import { describe, expect, it } from 'vitest';
import { cardIndex, parseCards } from '@/model/cards';
import { categoryName, evaluate } from './evaluator';
import { computeEquities } from './montecarlo';

const score = (text: string) => evaluate(parseCards(text).map(cardIndex));

describe('evaluator', () => {
  it('classifies every category', () => {
    expect(categoryName(score('Ah Kh Qh Jh Th 2c 3d'))).toBe('straight-flush');
    expect(categoryName(score('As Ah Ad Ac 2c 3d 9h'))).toBe('four-of-a-kind');
    expect(categoryName(score('As Ah Ad Kc Kd 3d 9h'))).toBe('full-house');
    expect(categoryName(score('As 9s 7s 4s 2s Kc Kd'))).toBe('flush');
    expect(categoryName(score('9s 8d 7c 6h 5s Kc Kd'))).toBe('straight');
    expect(categoryName(score('As 2d 3c 4h 5s Kc Qd'))).toBe('straight'); // wheel
    expect(categoryName(score('As Ah Ad 4h 5s Kc Qd'))).toBe('three-of-a-kind');
    expect(categoryName(score('As Ah 4d 4h 5s Kc Qd'))).toBe('two-pair');
    expect(categoryName(score('As Ah 4d 6h 5s Kc Qd'))).toBe('pair');
    expect(categoryName(score('As 2h 4d 6h 8s Kc Qd'))).toBe('high-card');
  });

  it('orders hands correctly within categories', () => {
    expect(score('As Ah Kd Kh 2s 3c 4d')).toBeGreaterThan(score('As Ah Qd Qh 2s 3c 4d'));
    expect(score('As Ah 2d 3h 4s 5c 9d')).toBeLessThan(score('6s 6h 2d 3h 4s 5c 9d')); // wheel < six-high straight
    expect(score('Ks Kh 9d 3h 4s 5c 2d')).toBeGreaterThan(score('Ks Kh 8d 3h 4s 5c 2d')); // kicker
    expect(score('Ah Kh 9h 3h 4h 5c 2d')).toBeGreaterThan(score('Kh Qh 9h 3h 4h 5c 2d')); // flush high card
    expect(score('As Ah Ad Kc Kd 3d 9h')).toBeGreaterThan(score('Ks Kh Kd Ac Ad 3d 9h')); // AAAKK > KKKAA
  });

  it('picks the best 5 of 7 (flush beats a straight on board)', () => {
    expect(categoryName(score('2h 3h 9s Th Jh Qh Kd'))).toBe('flush');
  });

  it('is fast enough', () => {
    const cards = parseCards('Ah Kd 7s 2c Tc 9h 4d').map(cardIndex);
    const n = 300_000;
    const t0 = performance.now();
    let acc = 0;
    for (let i = 0; i < n; i++) acc ^= evaluate(cards, 7);
    const dt = (performance.now() - t0) / 1000;
    expect(acc).toBeTypeOf('number');
    expect(n / dt).toBeGreaterThan(1_000_000);
  });
});

describe('equity', () => {
  it('AA vs KK preflop is ~81-82%', () => {
    const r = computeEquities({
      board: [],
      players: [
        { name: 'aa', cards: ['As', 'Ah'] },
        { name: 'kk', cards: ['Ks', 'Kh'] },
      ],
      iterations: 40000,
      seed: 12345,
    });
    expect(r.aa).toBeGreaterThan(0.795);
    expect(r.aa).toBeLessThan(0.835);
    expect(r.aa! + r.kk!).toBeCloseTo(1, 5);
  });

  it('is exact on the river and turn', () => {
    const river = computeEquities({
      board: ['Ac', '7d', '2s', '9h', '3c'],
      players: [
        { name: 'hero', cards: ['Ah', 'Kd'] },
        { name: 'villain', cards: ['7s', '7h'] },
      ],
      iterations: 10,
    });
    expect(river.hero).toBe(0);
    expect(river.villain).toBe(1);

    // Set vs top pair on the turn: an ace fills villain up, so hero is drawing dead.
    const dead = computeEquities({
      board: ['Ac', '7d', '2s', '9h'],
      players: [
        { name: 'hero', cards: ['Ah', 'Kd'] },
        { name: 'villain', cards: ['7s', '7h'] },
      ],
      iterations: 10,
    });
    expect(dead.hero).toBe(0);

    // Top pair vs two pair on the turn: 2 aces + 3 kings + 3 deuces (counterfeit) = 8 outs of 44.
    const turn = computeEquities({
      board: ['Ac', '7d', '2s', '9h'],
      players: [
        { name: 'hero', cards: ['Ah', 'Kd'] },
        { name: 'villain', cards: ['9s', '7s'] },
      ],
      iterations: 10,
    });
    expect(turn.hero).toBeCloseTo(8 / 44, 6);
  });

  it('splits ties and treats unknown players as random ranges', () => {
    const tie = computeEquities({
      board: ['Ac', 'Kd', 'Qs', 'Jh', 'Tc'],
      players: [
        { name: 'a', cards: ['2h', '3d'] },
        { name: 'b', cards: ['4s', '5c'] },
      ],
      iterations: 10,
    });
    expect(tie.a).toBeCloseTo(0.5, 6);

    const vsRandom = computeEquities({
      board: [],
      players: [{ name: 'aa', cards: ['As', 'Ah'] }, { name: 'x' }],
      iterations: 20000,
      seed: 7,
    });
    expect(vsRandom.aa).toBeGreaterThan(0.83);
    expect(vsRandom.x).toBeUndefined();
  });

  it('handles 3-way all-in equities summing to 1', () => {
    const r = computeEquities({
      board: ['Kh', '4d', '4c'],
      players: [
        { name: 'kk', cards: ['Ks', 'Kd'] },
        { name: 'a4', cards: ['Ah', '4s'] },
        { name: 'qq', cards: ['Qs', 'Qd'] },
      ],
      iterations: 10,
    });
    expect(r.kk! + r.a4! + r.qq!).toBeCloseTo(1, 6);
    expect(r.kk).toBeGreaterThan(0.9);
  });
});
