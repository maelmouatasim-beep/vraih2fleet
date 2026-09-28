/**
 * Résolution des subventions applicables à un véhicule à partir du
 * registre `subsidy-programs.ts` (docs/tco-methodologie.md §3.2) :
 * admissibilité → montant (fixe ou %) → plafonds → cumul (Σ ≤ coût
 * admissible) → année de versement. Seuls les programmes ACTIFS sont
 * comptés ; un barème à plafond 0 (« montant du projet à saisir »)
 * n'est jamais compté automatiquement.
 */

import type { CategorieVehicule, Technologie } from './assumption-types';
import { PROGRAMMES, type ProgrammeSubvention, type TypeOrganisme } from './subsidy-programs';
import type { SubventionAppliquee } from './types';

export interface DemandeSubventions {
  categorie: CategorieVehicule;
  technologie: Exclude<Technologie, 'diesel'>;
  prixAvantTaxes: number;
  typeOrganisme: TypeOrganisme;
  /** Le véhicule est-il assemblé/fabriqué au Québec (bonification Écocamionnage) ? */
  fabriqueAuQuebec?: boolean;
  /** Fabriqué au Canada (lève le plafond de transaction du PAVÉ). */
  fabriqueAuCanada?: boolean;
}

/** Règles d'admissibilité propres à un programme, non exprimables par le
 *  seul barème (documentées dans le registre). */
function admissibleSpecifique(prog: ProgrammeSubvention, d: DemandeSubventions): boolean {
  if (prog.id === 'pave') {
    // Transaction ≤ 50 000 $, sauf véhicule fabriqué au Canada (vérifié).
    return d.prixAvantTaxes <= 50000 || d.fabriqueAuCanada === true;
  }
  if (prog.id === 'roulez_vert') {
    // PDSF < 65 000 $ (vérifié).
    return d.prixAvantTaxes < 65000;
  }
  return true;
}

export function resoudreSubventionsVehicule(
  d: DemandeSubventions,
  programmes: ProgrammeSubvention[] = PROGRAMMES,
): SubventionAppliquee[] {
  if (!Number.isFinite(d.prixAvantTaxes) || d.prixAvantTaxes <= 0) {
    throw new Error('prixAvantTaxes invalide');
  }
  const retenues: SubventionAppliquee[] = [];

  for (const prog of programmes) {
    if (prog.statut !== 'actif' || prog.cible !== 'vehicule') continue;
    if (!prog.organismesAdmissibles.includes(d.typeOrganisme)) continue;
    if (!admissibleSpecifique(prog, d)) continue;

    // Meilleur barème admissible du programme (un seul par programme).
    let meilleur = 0;
    for (const b of prog.baremes) {
      if (!b.categories.includes(d.categorie) || !b.technologies.includes(d.technologie)) continue;
      if (b.plafondParVehicule <= 0) continue; // montant par projet : jamais automatique
      const brut =
        b.pourcentage !== undefined
          ? Math.min(b.pourcentage * d.prixAvantTaxes, b.plafondParVehicule)
          : b.plafondParVehicule;
      meilleur = Math.max(meilleur, brut);
    }
    if (meilleur <= 0) continue;

    if (d.fabriqueAuQuebec && prog.bonificationAchatLocal) {
      meilleur *= 1 + prog.bonificationAchatLocal;
    }
    retenues.push({ libelle: prog.nom, montant: meilleur, annee: prog.anneeVersementDefaut });
  }

  // Cumul : le total ne dépasse jamais le coût admissible (le prix avant
  // taxes en v1) — on tronque en commençant par les montants les plus
  // faibles pour préserver l'aide principale.
  const total = retenues.reduce((a, s) => a + s.montant, 0);
  if (total > d.prixAvantTaxes) {
    retenues.sort((a, b) => b.montant - a.montant);
    let budget = d.prixAvantTaxes;
    for (const s of retenues) {
      s.montant = Math.min(s.montant, Math.max(budget, 0));
      budget -= s.montant;
    }
  }
  return retenues.filter((s) => s.montant > 0);
}
