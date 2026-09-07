#!/usr/bin/env node
/**
 * Verifies that every locale file has exactly the same keys as en.json and
 * that no value is empty. Exit code 1 on any mismatch (used by CI).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));

const PLURAL = /_(zero|one|two|few|many|other)$/;

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

/** Plural forms differ per language (ru has few/many); compare base keys. */
function base(keys) {
  const out = {};
  for (const [k, v] of Object.entries(keys)) out[k.replace(PLURAL, '')] = v;
  return out;
}

const reference = base(flatten(load('en.json')));
const refKeys = Object.keys(reference).sort();
let failed = false;

for (const f of files) {
  const keys = base(flatten(load(f)));
  const missing = refKeys.filter((k) => !(k in keys));
  const extra = Object.keys(keys).filter((k) => !(k in reference));
  const empty = Object.entries(keys).filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([k]) => k);
  const badPlaceholders = refKeys.filter((k) => {
    if (!(k in keys)) return false;
    const ph = (s) => (String(s).match(/\{\{\w+\}\}/g) ?? []).sort().join(',');
    return ph(reference[k]) !== ph(keys[k]);
  });
  if (missing.length || extra.length || empty.length || badPlaceholders.length) {
    failed = true;
    console.error(`✗ ${f}`);
    if (missing.length) console.error(`  missing: ${missing.join(', ')}`);
    if (extra.length) console.error(`  extra: ${extra.join(', ')}`);
    if (empty.length) console.error(`  empty: ${empty.join(', ')}`);
    if (badPlaceholders.length) console.error(`  placeholder mismatch: ${badPlaceholders.join(', ')}`);
  } else {
    console.log(`✓ ${f} (${refKeys.length} keys)`);
  }
}

process.exit(failed ? 1 : 0);
