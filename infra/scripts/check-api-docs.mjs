#!/usr/bin/env node
/**
 * O inventário de rotas envelhece em silêncio.
 *
 * Vinte e cinco rotas foram escritas sem que `docs/API.md` soubesse, e ninguém
 * notou porque nada olhava. Este script lê as rotas do código, compara com a
 * tabela do documento, e falha quando as duas discordam. Assim a documentação
 * deixa de depender de alguém lembrar.
 *
 * `npm run check:api-docs`, e roda na CI.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const ROUTES_DIR = join(ROOT, 'src/server/interface/http/routes');
const DOC = join(ROOT, 'docs/API.md');

/**
 * As rotas de OAuth sao registradas num laco, com o caminho vindo de uma
 * variavel, entao a leitura do codigo nao as ve. Elas existem, estao em
 * oauth.ts, e ficam declaradas aqui para o verificador nao acusar falso.
 */
const REGISTERED_IN_A_LOOP = [
  'GET /auth/google',
  'GET /auth/google/callback',
  'GET /auth/facebook',
  'GET /auth/facebook/callback',
  'GET /auth/apple',
  'GET /auth/apple/callback',
  'POST /auth/apple/callback',
];

/** Every `app.get('/path'` in the route files, as "METHOD /path". */
function routesInCode() {
  const found = new Set();
  for (const file of readdirSync(ROUTES_DIR)) {
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(join(ROUTES_DIR, file), 'utf8');
    for (const match of source.matchAll(/app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
      found.add(`${match[1].toUpperCase()} ${match[2]}`);
    }
  }
  for (const route of REGISTERED_IN_A_LOOP) found.add(route);
  return found;
}

/** Every route the table names, as "METHOD /path". */
function routesInDoc() {
  const found = new Set();
  const source = readFileSync(DOC, 'utf8');
  for (const match of source.matchAll(/^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`/gm)) {
    found.add(`${match[1]} ${match[2]}`);
  }
  return found;
}

const code = routesInCode();
const doc = routesInDoc();

const undocumented = [...code].filter((route) => !doc.has(route)).sort();
const stale = [...doc].filter((route) => !code.has(route)).sort();

if (undocumented.length === 0 && stale.length === 0) {
  console.log(`✓ docs/API.md descreve as ${code.size} rotas, e nenhuma a mais`);
  process.exit(0);
}

if (undocumented.length) {
  console.error(`\n${undocumented.length} rota(s) no código e fora do documento:\n`);
  for (const route of undocumented) console.error(`  ${route}`);
}
if (stale.length) {
  console.error(`\n${stale.length} rota(s) no documento e fora do código:\n`);
  for (const route of stale) console.error(`  ${route}`);
}
console.error('\nAtualize docs/API.md. Uma rota sem documento é uma rota que ninguém sabe que existe.');
process.exit(1);
