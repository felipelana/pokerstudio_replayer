/**
 * How an assessment is measured. These rules live here, in the package both the
 * web app and the API import, so a number shown on screen and the same number
 * printed in a PDF or plotted on the dashboard can never disagree.
 *
 * Two ideas run through all of it and are easy to get wrong:
 *
 *  - A score of 0 is a real score. "No score" is the absence of one. Nothing
 *    here may turn a pending hand into a zero, or a zero into a pending hand.
 *  - Coverage is about hands the player actually played (VPIP). The score is
 *    about hands that were given a number, wherever they came from.
 */

export type AssessorRole = 'SELF' | 'COACH';
export type AssessmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

/** One assessor's reading of one hand, reduced to what the maths needs. */
export interface HandAssessmentInput {
  /** 0..100, or null/undefined when no score was given. */
  score?: number | null;
  /** Read and accepted as played. Never a score of any kind. */
  markedOk?: boolean;
  comment?: string | null;
  streetComments?: Record<string, string | undefined> | null;
  tags?: string[];
}

/** One hand of the session, as the maths sees it. */
export interface HandInput {
  /** Whether the hero voluntarily put money in. Unknown counts as not played. */
  heroVpip?: boolean | null;
  assessment?: HandAssessmentInput | null;
}

/**
 * Has this assessor actually said something about the hand? A score, an OK, a
 * comment on any street, or a tag all count. Merely walking past the hand in
 * the replayer does not.
 */
export function isReviewed(a?: HandAssessmentInput | null): boolean {
  if (!a) return false;
  if (a.score !== undefined && a.score !== null) return true;
  if (a.markedOk) return true;
  if (a.comment && a.comment.trim()) return true;
  if (a.tags && a.tags.length > 0) return true;
  if (a.streetComments && Object.values(a.streetComments).some((v) => v && v.trim())) return true;
  return false;
}

export interface Coverage {
  /** Hands the hero played and this assessor has read. */
  reviewed: number;
  /** Hands the hero played, full stop. */
  total: number;
  /** 0..100, or null when the session has no hands the hero played. */
  percent: number | null;
}

/**
 * Coverage: of the hands the player actually played, how many has this
 * assessor read? Each hand counts once. A session where the hero folded every
 * hand has nothing to cover, and says so with a null percentage rather than
 * a misleading 0% or 100%.
 */
export function coverage(hands: HandInput[]): Coverage {
  const played = hands.filter((h) => h.heroVpip === true);
  const reviewed = played.filter((h) => isReviewed(h.assessment)).length;
  return {
    reviewed,
    total: played.length,
    percent: played.length === 0 ? null : (reviewed / played.length) * 100,
  };
}

export interface Score {
  /** The mean of every score given, or null when none was. */
  value: number | null;
  /** How many hands carry a score — the sample the mean is built on. */
  scored: number;
}

/**
 * The score: the mean of the numbers actually given. Hands with no number are
 * left out entirely — a hand marked OK, or one that carries only a comment,
 * neither raises nor lowers it. A hand scored 0 does.
 *
 * A score on a hand the hero did not play still counts here; coverage is the
 * measure that stays with the hands they played.
 */
export function score(hands: HandInput[]): Score {
  const scores = hands
    .map((h) => h.assessment?.score)
    .filter((s): s is number => s !== undefined && s !== null);
  if (scores.length === 0) return { value: null, scored: 0 };
  return { value: scores.reduce((a, b) => a + b, 0) / scores.length, scored: scores.length };
}

/** One decimal for display; the full value is what gets carried around. */
export function formatScore(value: number | null): string | null {
  return value === null ? null : value.toFixed(1);
}

export interface LeakCount {
  tag: string;
  /** Hands this tag was put on. One hand counts once per tag. */
  hands: number;
  /** Share of the reviewed, played hands — the same base as coverage. */
  percent: number | null;
}

/**
 * The leaks this assessor marked most often, commonest first.
 *
 * The base is the reviewed hands the hero played, so the percentage sits on the
 * same ground as coverage. One hand may carry several tags, so these can add up
 * to more than 100% — that is the nature of the count, not a mistake in it.
 */
export function leaks(hands: HandInput[]): LeakCount[] {
  const base = hands.filter((h) => h.heroVpip === true && isReviewed(h.assessment)).length;
  const counts = new Map<string, number>();
  for (const hand of hands) {
    const tags = hand.assessment?.tags;
    if (!tags) continue;
    // One hand counts once per tag, however many times it was written.
    for (const tag of new Set(tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, hands: count, percent: base === 0 ? null : (count / base) * 100 }))
    .sort((a, b) => b.hands - a.hands || a.tag.localeCompare(b.tag));
}

/** Everything a report or a card needs to state about one assessment. */
export interface AssessmentSummary {
  score: Score;
  coverage: Coverage;
  /** Hands the hero played that this assessor has not read yet. */
  pending: number;
}

export function summarise(hands: HandInput[]): AssessmentSummary {
  const cov = coverage(hands);
  return { score: score(hands), coverage: cov, pending: cov.total - cov.reviewed };
}

/* ------------------------------------------------------------------ */
/* The rubric                                                          */
/* ------------------------------------------------------------------ */

export interface RubricBandInput {
  minScore: number;
  maxScore: number;
  description: string;
}

/** The bands the product ships with. Administration may replace them. */
export const DEFAULT_RUBRIC: RubricBandInput[] = [
  { minScore: 0, maxScore: 20, description: 'Muitos erros na decisão.' },
  { minScore: 21, maxScore: 40, description: 'Erros importantes.' },
  { minScore: 41, maxScore: 60, description: 'Jogada razoável, com pontos para melhorar.' },
  { minScore: 61, maxScore: 80, description: 'Boa jogada, com pequenos ajustes.' },
  { minScore: 81, maxScore: 100, description: 'Jogada muito bem executada.' },
];

/**
 * A rubric has to answer for every score from 0 to 100, and answer only once.
 * Returns the problems found, so the administration screen can name them.
 */
export function validateRubric(bands: RubricBandInput[]): string[] {
  const problems: string[] = [];
  if (bands.length === 0) return ['A rubrica precisa de pelo menos uma faixa.'];

  for (const b of bands) {
    if (!Number.isInteger(b.minScore) || !Number.isInteger(b.maxScore)) problems.push('As faixas usam números inteiros.');
    if (b.minScore < 0 || b.maxScore > 100) problems.push('As faixas ficam entre 0 e 100.');
    if (b.minScore > b.maxScore) problems.push(`Faixa invertida: ${b.minScore}–${b.maxScore}.`);
    if (!b.description.trim()) problems.push('Cada faixa precisa de uma descrição.');
  }

  const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);
  if (sorted[0].minScore !== 0) problems.push('A primeira faixa precisa começar em 0.');
  if (sorted[sorted.length - 1].maxScore !== 100) problems.push('A última faixa precisa terminar em 100.');
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (current.minScore <= previous.maxScore) problems.push(`As faixas ${previous.minScore}–${previous.maxScore} e ${current.minScore}–${current.maxScore} se sobrepõem.`);
    else if (current.minScore !== previous.maxScore + 1) problems.push(`Faltam notas entre ${previous.maxScore} e ${current.minScore}.`);
  }
  return [...new Set(problems)];
}

/** The band a score falls in, or nothing when the rubric does not cover it. */
export function bandFor(bands: RubricBandInput[], value: number): RubricBandInput | undefined {
  return bands.find((b) => value >= b.minScore && value <= b.maxScore);
}

/* ------------------------------------------------------------------ */
/* Coach passwords                                                     */
/* ------------------------------------------------------------------ */

/** Exactly this long, so the rule is the same wherever it is checked. */
export const COACH_PASSWORD_LENGTH = 8;

/**
 * What a coach password has to be: eight characters, upper and lower case, at
 * least one digit, and no run of digits following one another in value —
 * "13" is fine, "12" and "21" are not, whether or not they are adjacent to
 * other digits. The rule is stated here so the message can state it too.
 */
export function validateCoachPassword(password: string): string[] {
  const problems: string[] = [];
  if (password.length !== COACH_PASSWORD_LENGTH) problems.push(`A senha precisa ter exatamente ${COACH_PASSWORD_LENGTH} caracteres.`);
  if (!/[A-Z]/.test(password)) problems.push('Inclua pelo menos uma letra maiúscula.');
  if (!/[a-z]/.test(password)) problems.push('Inclua pelo menos uma letra minúscula.');
  if (!/[0-9]/.test(password)) problems.push('Inclua pelo menos um número.');
  if (/[^A-Za-z0-9]/.test(password)) problems.push('Use apenas letras e números.');
  if (hasSequentialDigits(password)) problems.push('Evite números em sequência, como 12 ou 21.');
  return problems;
}

/** Two digits side by side whose values follow one another, up or down. */
export function hasSequentialDigits(text: string): boolean {
  for (let i = 1; i < text.length; i++) {
    const a = text.charCodeAt(i - 1) - 48;
    const b = text.charCodeAt(i) - 48;
    const bothDigits = a >= 0 && a <= 9 && b >= 0 && b <= 9;
    if (bothDigits && Math.abs(a - b) === 1) return true;
  }
  return false;
}

/**
 * A password that satisfies the rule, drawn from a source of randomness the
 * caller provides (crypto in both runtimes). Retries rather than patching a
 * bad draw, so every allowed password stays equally likely.
 */
export function suggestCoachPassword(random: (max: number) => number): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  for (let attempt = 0; attempt < 200; attempt++) {
    const chars = Array.from({ length: COACH_PASSWORD_LENGTH }, () => all[random(all.length)]);
    const candidate = chars.join('');
    if (validateCoachPassword(candidate).length === 0) return candidate;
  }
  // Deterministic fallback that satisfies the rule, so this never returns junk.
  return 'Pk7Studio'.slice(0, COACH_PASSWORD_LENGTH);
}

/* ------------------------------------------------------------------ */
/* The player's own reading                                            */
/* ------------------------------------------------------------------ */

/**
 * The replayer has always let the player rate a hand from one to five stars.
 * A coach writes a number from 0 to 100. To put the two side by side, the
 * stars are read on this ruler, decided with the product owner:
 *
 *   ★ 10   ★★ 30   ★★★ 50   ★★★★ 75   ★★★★★ 95
 *
 * It is deliberately not linear. One star means the hand was played badly, not
 * that it scored 20; five means very well, not perfect. The gap at the top is
 * what keeps a session of five-star hands from reading as a flawless 100.
 */
export const STAR_SCORE: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 10, 2: 30, 3: 50, 4: 75, 5: 95 };

/** The 0 to 100 score a star rating stands for, or undefined when unrated. */
export function scoreForStars(stars?: number | null): number | undefined {
  if (stars === undefined || stars === null) return undefined;
  return STAR_SCORE[Math.min(5, Math.max(1, Math.round(stars))) as 1 | 2 | 3 | 4 | 5];
}
