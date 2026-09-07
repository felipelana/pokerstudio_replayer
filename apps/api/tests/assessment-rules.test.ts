import { describe, expect, it } from 'vitest';
import {
  bandFor,
  coverage,
  DEFAULT_RUBRIC,
  formatScore,
  hasSequentialDigits,
  isReviewed,
  leaks,
  score,
  suggestCoachPassword,
  summarise,
  validateCoachPassword,
  validateRubric,
  type HandInput,
} from '@pokerstudio/shared';

/** Shorthand: a hand the hero played, with whatever the assessor said. */
const played = (assessment?: HandInput['assessment']): HandInput => ({ heroVpip: true, assessment });
const folded = (assessment?: HandInput['assessment']): HandInput => ({ heroVpip: false, assessment });

describe('what counts as read', () => {
  it('takes a score, an OK, a comment, a street comment or a tag', () => {
    expect(isReviewed({ score: 0 })).toBe(true);
    expect(isReviewed({ markedOk: true })).toBe(true);
    expect(isReviewed({ comment: 'thin value' })).toBe(true);
    expect(isReviewed({ streetComments: { turn: 'too big' } })).toBe(true);
    expect(isReviewed({ tags: ['sizing'] })).toBe(true);
  });

  it('does not take an empty record, or blank text', () => {
    expect(isReviewed(undefined)).toBe(false);
    expect(isReviewed(null)).toBe(false);
    expect(isReviewed({})).toBe(false);
    expect(isReviewed({ comment: '   ' })).toBe(false);
    expect(isReviewed({ streetComments: { flop: '  ' } })).toBe(false);
    expect(isReviewed({ tags: [] })).toBe(false);
  });

  it('treats a score of zero as read — it is a score, not a blank', () => {
    expect(isReviewed({ score: 0 })).toBe(true);
    expect(isReviewed({ score: null })).toBe(false);
  });
});

describe('coverage', () => {
  it('counts only the hands the hero played, once each', () => {
    const c = coverage([played({ score: 55 }), played({ markedOk: true }), played(), folded({ score: 80 })]);
    expect(c).toEqual({ reviewed: 2, total: 3, percent: (2 / 3) * 100 });
  });

  it('says nothing rather than 0% or 100% when the hero played no hand', () => {
    expect(coverage([folded(), folded({ comment: 'ok fold' })]).percent).toBeNull();
    expect(coverage([]).percent).toBeNull();
  });

  it('does not count a hand merely walked past in the replayer', () => {
    // An empty record is what "opened the hand and moved on" leaves behind.
    expect(coverage([played({}), played({})]).reviewed).toBe(0);
  });

  it('treats an unknown VPIP as not played, rather than guessing', () => {
    expect(coverage([{ heroVpip: null, assessment: { score: 70 } }]).total).toBe(0);
    expect(coverage([{ assessment: { score: 70 } }]).percent).toBeNull();
  });
});

describe('score', () => {
  it('averages the scores actually given, and reports the sample', () => {
    expect(score([played({ score: 40 }), played({ score: 80 })])).toEqual({ value: 60, scored: 2 });
  });

  it('leaves out hands with no score, including an OK', () => {
    const s = score([played({ score: 90 }), played({ markedOk: true }), played({ comment: 'later' }), played()]);
    expect(s).toEqual({ value: 90, scored: 1 });
  });

  it('never turns a pending hand into a zero', () => {
    const withPending = score([played({ score: 60 }), played()]);
    const alone = score([played({ score: 60 })]);
    expect(withPending).toEqual(alone);
  });

  it('counts a real zero, which is not the same as no score', () => {
    expect(score([played({ score: 0 }), played({ score: 100 })])).toEqual({ value: 50, scored: 2 });
    expect(score([played({ score: 0 })]).value).toBe(0);
  });

  it('has no value at all when nothing was scored', () => {
    expect(score([played({ markedOk: true })])).toEqual({ value: null, scored: 0 });
    expect(formatScore(null)).toBeNull();
  });

  it('counts a score given on a hand the hero did not play, while coverage does not', () => {
    const hands = [played({ score: 50 }), folded({ score: 100 })];
    expect(score(hands)).toEqual({ value: 75, scored: 2 });
    expect(coverage(hands)).toEqual({ reviewed: 1, total: 1, percent: 100 });
  });

  it('shows one decimal while keeping the precision behind it', () => {
    const s = score([played({ score: 70 }), played({ score: 71 }), played({ score: 73 })]);
    expect(s.value).toBeCloseTo(71.333333, 5);
    expect(formatScore(s.value)).toBe('71.3');
  });
});

describe('summary', () => {
  it('states what is still pending among the hands the hero played', () => {
    const s = summarise([played({ score: 10 }), played(), played(), folded()]);
    expect(s.pending).toBe(2);
    expect(s.coverage.reviewed).toBe(1);
    expect(s.score.scored).toBe(1);
  });
});

describe('leaks', () => {
  it('ranks tags by the hands they were put on, counting each hand once', () => {
    const hands = [
      played({ tags: ['sizing', 'sizing', 'overfold'] }),
      played({ tags: ['sizing'] }),
      played({ tags: ['overfold'] }),
    ];
    // Equal counts fall back to alphabetical order, so the list is stable.
    expect(leaks(hands).map((l) => [l.tag, l.hands])).toEqual([
      ['overfold', 2],
      ['sizing', 2],
    ]);
  });

  it('measures against the reviewed hands the hero played, so shares may pass 100%', () => {
    const hands = [played({ tags: ['a', 'b'] }), played({ tags: ['a'] }), played(), folded({ tags: ['a'] })];
    const found = leaks(hands);
    // Two reviewed played hands; 'a' is on three hands including a folded one.
    expect(found[0]).toEqual({ tag: 'a', hands: 3, percent: 150 });
  });

  it('has no share to give when nothing played was reviewed', () => {
    expect(leaks([folded({ tags: ['a'] })])[0].percent).toBeNull();
  });
});

describe('the rubric', () => {
  it('accepts the bands the product ships with', () => {
    expect(validateRubric(DEFAULT_RUBRIC)).toEqual([]);
    expect(bandFor(DEFAULT_RUBRIC, 0)?.maxScore).toBe(20);
    expect(bandFor(DEFAULT_RUBRIC, 100)?.minScore).toBe(81);
    expect(bandFor(DEFAULT_RUBRIC, 41)?.description).toContain('razoável');
  });

  it('refuses a gap, an overlap, or an edge that does not reach', () => {
    expect(validateRubric([{ minScore: 0, maxScore: 40, description: 'a' }, { minScore: 50, maxScore: 100, description: 'b' }])).toContain(
      'Faltam notas entre 40 e 50.',
    );
    expect(
      validateRubric([{ minScore: 0, maxScore: 60, description: 'a' }, { minScore: 40, maxScore: 100, description: 'b' }]).some((p) =>
        p.includes('se sobrepõem'),
      ),
    ).toBe(true);
    expect(validateRubric([{ minScore: 10, maxScore: 100, description: 'a' }])).toContain('A primeira faixa precisa começar em 0.');
    expect(validateRubric([{ minScore: 0, maxScore: 90, description: 'a' }])).toContain('A última faixa precisa terminar em 100.');
  });
});

describe('coach passwords', () => {
  it('names the digit-sequence rule it enforces', () => {
    expect(hasSequentialDigits('a1b2')).toBe(false);
    expect(hasSequentialDigits('ab12cd')).toBe(true);
    expect(hasSequentialDigits('ab21cd')).toBe(true);
    expect(hasSequentialDigits('ab13cd')).toBe(false);
  });

  it('asks for eight characters, both cases and a digit', () => {
    expect(validateCoachPassword('Ab3xKp7z')).toEqual([]);
    expect(validateCoachPassword('Ab3xKp7')).toContain('A senha precisa ter exatamente 8 caracteres.');
    expect(validateCoachPassword('ab3xkp7z')).toContain('Inclua pelo menos uma letra maiúscula.');
    expect(validateCoachPassword('AB3XKP7Z')).toContain('Inclua pelo menos uma letra minúscula.');
    expect(validateCoachPassword('AbxxKpzz')).toContain('Inclua pelo menos um número.');
    expect(validateCoachPassword('Ab34Kpzz')).toContain('Evite números em sequência, como 12 ou 21.');
  });

  it('suggests only passwords that pass its own rule', () => {
    for (let i = 0; i < 200; i++) {
      const suggested = suggestCoachPassword((max) => Math.floor(Math.random() * max));
      expect(validateCoachPassword(suggested), suggested).toEqual([]);
    }
  });
});
