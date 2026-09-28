#!/usr/bin/env node
/**
 * Génère docs/tco-cas-de-reference.json : entrées (cas-definitions.mjs)
 * + sorties calculées par le CONTRE-CALCULATEUR indépendant
 * (contre-calcul.mjs — jamais par le moteur src/lib/tco).
 *
 *   node scripts/reference-cases/generate.mjs           # régénère
 *   node scripts/reference-cases/generate.mjs --check   # CI : échoue si
 *                                                       # le JSON committé diffère
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { CAS, PARAMETRES_CAS } from './cas-definitions.mjs';
import { contreCalculerPlan } from './contre-calcul.mjs';

const CHEMIN = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/tco-cas-de-reference.json');

const arrondir = (v, d) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

function sortiesArrondies(r) {
  return {
    tcoActualiseAlt: arrondir(r.tcoActualiseAlt, 2),
    tcoActualiseRef: arrondir(r.tcoActualiseRef, 2),
    vanDifferentielle: arrondir(r.vanDifferentielle, 2),
    tcoParKmAlt: arrondir(r.tcoParKmAlt, 4),
    paybackSimpleAns: r.paybackSimple.annees,
    paybackSimpleRaison: r.paybackSimple.raison,
    paybackActualiseAns: r.paybackActualise.annees,
    paybackActualiseRaison: r.paybackActualise.raison,
    co2EviteTtwTonnes: arrondir(r.co2EviteTtwTonnes, 3),
    co2EviteWtwTonnes: arrondir(r.co2EviteWtwTonnes, 3),
    coutParTonneWtw: arrondir(r.coutParTonneWtw, 2),
  };
}

const document = {
  avertissement:
    'FICHIER GÉNÉRÉ par scripts/reference-cases/generate.mjs — ne pas éditer à la main. ' +
    'Les sorties viennent du contre-calculateur INDÉPENDANT (contre-calcul.mjs), jamais du moteur : ' +
    'ne jamais modifier ce fichier pour faire passer un test du moteur.',
  parametresCommuns: PARAMETRES_CAS,
  cas: CAS.map((c) => ({
    id: c.id,
    titre: c.titre,
    notes: c.notes,
    entrees: c.plan,
    sorties: sortiesArrondies(contreCalculerPlan(c.plan)),
  })),
};

const contenu = JSON.stringify(document, null, 1) + '\n';

if (process.argv.includes('--check')) {
  const actuel = readFileSync(CHEMIN, 'utf-8');
  if (actuel !== contenu) {
    console.error(
      'docs/tco-cas-de-reference.json ne correspond pas au contre-calculateur — ' +
        'lancer `node scripts/reference-cases/generate.mjs` et committer le résultat.',
    );
    process.exit(1);
  }
  console.log('OK — le JSON des cas de référence correspond au contre-calculateur.');
} else {
  writeFileSync(CHEMIN, contenu);
  console.log(`Écrit : ${CHEMIN} (${document.cas.length} cas).`);
}
