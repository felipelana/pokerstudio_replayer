#!/usr/bin/env node
/**
 * The interface has a voice, and this is the part of it a machine can hold.
 *
 * It reads every string a reader can actually see: the translation files of the
 * replayer and of the landing page, the landing page's own HTML, and the string
 * literals in the source. Code comments are stripped before the scan, so a note
 * to another developer is never mistaken for something on screen.
 *
 * Two things fail the check:
 *
 *   dashes   an em dash or en dash used as punctuation. Portuguese, English and
 *            the other six all have a comma, a colon and a full stop; the dash
 *            is a tic, and it reads as one.
 *   phrases  the stock openings and hedges that come with generated prose.
 *
 * Run it with `npm run check:copy`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Where interface text lives. */
const TARGETS = [
  'src/i18n/locales',
  'src',
  'landingpage/src/locales',
  'landingpage/src',
  'landingpage/index.html',
];

const SKIP = /node_modules|dist|\.git|coverage|fixtures/;
const READ = /\.(json|ts|tsx|html)$/;

/**
 * Turns of phrase that mark text as written by a machine rather than by
 * someone with something to say. The list is deliberately short: each entry
 * has to be wrong often enough that a blanket ban is fair.
 */
const PHRASES = [
  { re: /\bdelve\b/i, why: 'delve' },
  { re: /\bseamless(ly)?\b/i, why: 'seamless' },
  { re: /\bunlock the (power|potential)\b/i, why: 'unlock the power' },
  { re: /\bgame[- ]chang(er|ing)\b/i, why: 'game changer' },
  { re: /\bcutting[- ]edge\b/i, why: 'cutting edge' },
  { re: /\bin today's (fast[- ]paced|digital) world\b/i, why: "in today's world" },
  { re: /\bit'?s (important|worth) (to note|noting)\b/i, why: 'it is worth noting' },
  { re: /\bwe are thrilled\b/i, why: 'we are thrilled' },
  { re: /\brevolutionar(y|ise|ize)\b/i, why: 'revolutionary' },
  { re: /\bharness(ing)? the\b/i, why: 'harness the' },
  { re: /\bembark on\b/i, why: 'embark on' },
  { re: /\bmergulhe\b/i, why: 'mergulhe' },
  { re: /\bsem esforço\b/i, why: 'sem esforço' },
  { re: /\bleve (seu|sua) [a-zç]+ (para )?(o )?próximo n[íi]vel\b/i, why: 'próximo nível' },
  { re: /\bvale (a pena )?(destacar|ressaltar) que\b/i, why: 'vale ressaltar que' },
  { re: /\bno mundo (atual|de hoje)\b/i, why: 'no mundo de hoje' },
  { re: /\brevolucionár(io|ia)\b/i, why: 'revolucionário' },
];

/** Comments are for developers, not readers: take them out before scanning. */
function withoutComments(source, file) {
  if (file.endsWith('.json')) return source;
  if (file.endsWith('.html')) return source.replace(/<!--[\s\S]*?-->/g, (m) => blank(m));
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => blank(m)).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m) => blank(m));
}

/** Replace a run with spaces and newlines, so line numbers stay true. */
function blank(text) {
  return text.replace(/[^\n]/g, ' ');
}

function* files(target) {
  const full = join(ROOT, target);
  if (!statSync(full).isDirectory()) {
    yield target;
    return;
  }
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const next = `${target}/${entry.name}`;
    if (SKIP.test(next)) continue;
    if (entry.isDirectory()) yield* files(next);
    else if (READ.test(entry.name)) yield next;
  }
}

const seen = new Set();
const problems = [];

for (const target of TARGETS) {
  for (const file of files(target)) {
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(join(ROOT, file), 'utf8');
    const text = withoutComments(source, file);
    text.split('\n').forEach((line, index) => {
      const where = `${file}:${index + 1}`;
      if (/[—–]/.test(line)) problems.push({ where, why: 'travessão', line: line.trim() });
      for (const phrase of PHRASES) {
        if (phrase.re.test(line)) problems.push({ where, why: phrase.why, line: line.trim() });
      }
    });
  }
}

if (problems.length === 0) {
  console.log(`✓ ${seen.size} arquivos de texto sem travessão e sem clichê`);
  process.exit(0);
}

console.error(`${problems.length} trecho(s) para corrigir:\n`);
for (const problem of problems) {
  console.error(`  ${problem.where}  [${problem.why}]`);
  console.error(`    ${problem.line.slice(0, 140)}`);
}
console.error(`\nTexto de interface não usa travessão. Uma vírgula, dois-pontos ou um ponto dizem o mesmo.`);
console.error(`Um marcador de valor ausente é "-". Um separador entre dois campos é "·".`);
process.exit(1);

