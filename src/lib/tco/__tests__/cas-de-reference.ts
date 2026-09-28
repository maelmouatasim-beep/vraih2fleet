/**
 * Cas de référence du moteur : les ENTRÉES ET les sorties attendues
 * viennent de docs/tco-cas-de-reference.json, GÉNÉRÉ par
 * scripts/reference-cases/generate.mjs à partir des définitions
 * (cas-definitions.mjs) et du CONTRE-CALCULATEUR indépendant
 * (contre-calcul.mjs — implémentation naïve distincte du moteur).
 * La CI vérifie que le JSON committé correspond au générateur
 * (`generate.mjs --check`) : ne JAMAIS éditer le JSON à la main, ni le
 * régénérer pour faire passer un test sans comprendre l'écart.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ParametresProjet, PlanTcoEntree } from '../types';

const DOCUMENT = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../docs/tco-cas-de-reference.json'), 'utf-8'),
) as {
  parametresCommuns: ParametresProjet;
  cas: Array<{ id: number; titre: string; entrees: PlanTcoEntree }>;
};

export const PARAMETRES_CAS: ParametresProjet = DOCUMENT.parametresCommuns;

/** Fabriques d'entrées (clonées : chaque test reçoit sa copie). */
export const CAS: Array<() => PlanTcoEntree> = DOCUMENT.cas.map(
  (c) => () => structuredClone(c.entrees),
);

export const cas1 = CAS[0];
export const cas4 = CAS[3];
export const cas5 = CAS[4];
