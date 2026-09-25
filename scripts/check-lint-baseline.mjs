#!/usr/bin/env node
// Lint en mode "baseline" : le dépôt porte une dette ESLint connue
// (scripts/lint-baseline.json, erreurs par règle). Ce script échoue seulement
// si une règle dépasse son compte de la baseline — donc uniquement sur les
// NOUVELLES erreurs. Les avertissements ne bloquent pas.
//
// Usage :
//   node scripts/check-lint-baseline.mjs            # compare à la baseline
//   node scripts/check-lint-baseline.mjs --update   # réécrit la baseline
//
// Quand une règle passe sous son compte baseline, le script le signale :
// lancer --update pour verrouiller le progrès.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(root, 'scripts', 'lint-baseline.json');
const update = process.argv.includes('--update');

let raw;
try {
  raw = execFileSync('npx', ['eslint', '.', '--format', 'json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (e) {
  // eslint sort en code 1 dès qu'il y a des erreurs ; le JSON est sur stdout.
  if (!e.stdout) throw e;
  raw = e.stdout.toString();
}

const results = JSON.parse(raw);
const counts = {};
for (const file of results) {
  for (const msg of file.messages) {
    if (msg.severity !== 2) continue; // erreurs seulement
    const rule = msg.ruleId ?? '(fatal)';
    counts[rule] = (counts[rule] ?? 0) + 1;
  }
}

const sorted = Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));

if (update) {
  writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Baseline réécrite (${Object.values(sorted).reduce((a, b) => a + b, 0)} erreurs) :`);
  console.table(sorted);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
} catch {
  console.error(`Baseline introuvable ou illisible : ${baselinePath}`);
  console.error('Générer avec : node scripts/check-lint-baseline.mjs --update');
  process.exit(1);
}

const regressions = [];
const improvements = [];
for (const [rule, count] of Object.entries(sorted)) {
  const allowed = baseline[rule] ?? 0;
  if (count > allowed) regressions.push({ rule, allowed, actual: count });
  else if (count < allowed) improvements.push({ rule, allowed, actual: count });
}
for (const [rule, allowed] of Object.entries(baseline)) {
  if (!(rule in sorted) && allowed > 0) improvements.push({ rule, allowed, actual: 0 });
}

const total = Object.values(sorted).reduce((a, b) => a + b, 0);
console.log(`ESLint : ${total} erreur(s) au total (baseline : ${Object.values(baseline).reduce((a, b) => a + b, 0)}).`);

if (improvements.length) {
  console.log('\nRègles améliorées par rapport à la baseline (lancer --update pour verrouiller) :');
  console.table(improvements);
}

if (regressions.length) {
  console.error('\n❌ Nouvelles erreurs de lint par rapport à la baseline :');
  console.table(regressions);
  console.error('Corriger ces erreurs, ou si elles sont assumées, mettre à jour la baseline avec --update.');
  process.exit(1);
}

console.log('✅ Aucune nouvelle erreur de lint.');
