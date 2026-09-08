/**
 * Fails when a locale is missing a key that English has, or carries one English
 * does not. Same idea as the replayer's own check, so a new string cannot be
 * shipped translated into one language only.
 *
 *     node scripts/check-locales.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/locales');
const REFERENCE = 'en.json';

function flatten(value, prefix = '') {
  if (value === null || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

const reference = flatten(JSON.parse(readFileSync(path.join(dir, REFERENCE), 'utf8')));
const referenceSet = new Set(reference);
let failed = false;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  if (file === REFERENCE) continue;
  const keys = flatten(JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
  const keySet = new Set(keys);
  const missing = reference.filter((k) => !keySet.has(k));
  const extra = keys.filter((k) => !referenceSet.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n${file}`);
    for (const k of missing) console.error(`  missing: ${k}`);
    for (const k of extra) console.error(`  extra:   ${k}`);
  } else {
    console.log(`${file}: ${keys.length} keys, ok`);
  }
}

if (failed) {
  console.error('\nLocale files are out of sync.');
  process.exit(1);
}
console.log('\nAll locales match en.json.');
