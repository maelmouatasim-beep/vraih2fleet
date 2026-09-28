#!/usr/bin/env node
/**
 * Garde-fou : les constantes d'hypothèses de calcul (facteurs CO2,
 * consommations, prix d'énergie, jours d'exploitation…) ne vivent QUE
 * dans src/lib/tco/. Fonctionne comme la baseline de lint : les
 * occurrences héritées (ancien moteur et calculs inline, en cours de
 * suppression — phases 2-3 de la refonte) sont figées dans
 * scripts/hypothesis-constants-baseline.json ; toute NOUVELLE occurrence
 * (nouveau fichier, ou compte en hausse dans un fichier hérité) fait
 * échouer la CI. La baseline ne peut que décroître.
 *
 * Régénérer la baseline APRÈS une résorption :
 *   node scripts/check-hypothesis-constants.mjs --baseline
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const MOTIFS = [
  { nom: 'facteur CO2 diesel (2,6x)', re: /\b2[.,]6(8[0-9]?|9)?\b/g },
  { nom: 'conso diesel 35,7 L/100', re: /\b35[.,]7\b/g },
  { nom: 'prix diesel codé (1,48 / 1,85)', re: /\b1[.,](48|85)\b/g },
  { nom: 'conso BEV 120 kWh/100 codée', re: /(?:=|:)\s*120(?![\d.])/g },
  { nom: 'jours d’exploitation codés (×365/300/250)', re: /\*\s*(365|300|250)\b/g },
  { nom: 'prix H2 codé (12 $/kg)', re: /hydrogen_price[^\n]*=\s*12\b|\b12[.,]0\s*;?\s*\/\/\s*\$\/kg/g },
];

const BASELINE_PATH = new URL('./hypothesis-constants-baseline.json', import.meta.url);

// Périmètre : le code applicatif TypeScript, hors moteur TCO (autorisé),
// hors tests, hors types Supabase générés.
const fichiers = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx" "supabase/functions/**/*.ts"', {
  encoding: 'utf-8',
})
  .split('\n')
  .filter(Boolean)
  .filter(
    (f) =>
      !f.startsWith('src/lib/tco/') &&
      !f.includes('__tests__') &&
      !f.endsWith('.test.ts') &&
      !f.startsWith('src/integrations/supabase/'),
  );

const constats = {};
for (const f of fichiers) {
  let contenu;
  try {
    contenu = readFileSync(f, 'utf-8');
  } catch {
    continue; // supprimé du disque mais encore listé par git avant commit
  }
  for (const motif of MOTIFS) {
    const n = (contenu.match(motif.re) ?? []).length;
    if (n > 0) {
      constats[f] ??= {};
      constats[f][motif.nom] = n;
    }
  }
}

if (process.argv.includes('--baseline')) {
  writeFileSync(BASELINE_PATH, JSON.stringify(constats, null, 2) + '\n');
  console.log(`Baseline régénérée : ${Object.keys(constats).length} fichiers hérités.`);
  process.exit(0);
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
} catch {
  console.error('Baseline absente — lancer : node scripts/check-hypothesis-constants.mjs --baseline');
  process.exit(1);
}

const erreurs = [];
for (const [fichier, motifs] of Object.entries(constats)) {
  for (const [nom, n] of Object.entries(motifs)) {
    const permis = baseline[fichier]?.[nom] ?? 0;
    if (n > permis) {
      erreurs.push(
        `${fichier} : ${n} occurrence(s) de « ${nom} » (baseline : ${permis}). ` +
          'Les hypothèses de calcul vivent dans src/lib/tco/assumptions.ts.',
      );
    }
  }
}

if (erreurs.length > 0) {
  console.error('Constantes d’hypothèses hors src/lib/tco/ :\n' + erreurs.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log('OK — aucune nouvelle constante d’hypothèse hors src/lib/tco/.');
