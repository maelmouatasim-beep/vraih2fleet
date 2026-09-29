/**
 * Résolution des subventions applicables à un véhicule à partir du
 * registre `subsidy-programs.ts` (docs/tco-methodologie.md §3.2) :
 * admissibilité → barème de la classe de poids EXACTE (jamais le plus
 * élevé : sans classe connue, le barème LE PLUS BAS des classes
 * possibles est retenu par prudence, avec avertissement) → montant
 * (fixe, dégressif par année d'achat, ou %) → bonification DANS le
 * plafond → plafond de cumul des aides publiques du programme (ex.
 * Écocamionnage art. 7.14.2 : 75 % des dépenses admissibles) →
 * Σ ≤ coût admissible → année de versement. Seuls les programmes
 * ACTIFS sont comptés ; un barème à plafond 0 (« montant du projet à
 * saisir ») n'est jamais compté automatiquement.
 */

import type { CategorieVehicule, Technologie } from './assumption-types';
import {
  PROGRAMMES,
  type BaremeSubvention,
  type ClassePoids,
  type ProgrammeSubvention,
  type TypeOrganisme,
} from './subsidy-programs';
import type { SubventionAppliquee } from './types';

export interface DemandeSubventions {
  categorie: CategorieVehicule;
  technologie: Exclude<Technologie, 'diesel'>;
  prixAvantTaxes: number;
  typeOrganisme: TypeOrganisme;
  /** Classe de poids réglementaire (PNBV) du véhicule, si connue :
   *  détermine le barème EXACT des programmes par classe (Écocamionnage).
   *  Absente, le barème le plus bas des classes possibles est retenu. */
  classePoids?: ClassePoids;
  /** Le véhicule est-il assemblé/fabriqué au Québec (bonification Écocamionnage) ? */
  fabriqueAuQuebec?: boolean;
  /** Fabriqué au Canada (lève le plafond de transaction du PAVÉ). */
  fabriqueAuCanada?: boolean;
  /** Année CALENDAIRE de l'achat (ex. 2029) : un programme dont la date
   *  de fin tombe une année antérieure n'est pas compté, et les barèmes
   *  dégressifs (PAVÉ, Écocamionnage 2b) prennent le montant de cette
   *  année-là. Absent = achat immédiat (montant de l'année vérifiée). */
  anneeAchatCalendaire?: number;
}

export interface ResolutionSubventions {
  subventions: SubventionAppliquee[];
  /** Conditions et prudences à montrer à l'utilisateur (classe de poids
   *  inconnue, % à valider, limites par organisation, RPEVL/CTQ…). */
  avertissements: string[];
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

/** Montant BRUT d'un barème (avant bonification), ou null si le barème
 *  ne produit aucun montant automatique. */
function montantBrut(b: BaremeSubvention, d: DemandeSubventions): number | null {
  // Forfait dégressif selon l'année calendaire d'achat.
  if (b.montantParAnneeAchat && d.anneeAchatCalendaire !== undefined) {
    const m = b.montantParAnneeAchat[d.anneeAchatCalendaire];
    return m !== undefined && m > 0 ? m : null;
  }
  if (b.plafondParVehicule <= 0) return null; // montant par projet : jamais automatique
  return b.pourcentage !== undefined
    ? Math.min(b.pourcentage * d.prixAvantTaxes, b.plafondParVehicule)
    : b.plafondParVehicule;
}

/** Plafond dans lequel s'applique la bonification : le montant du
 *  forfait lui-même, ou le plafond du barème. */
function plafondEffectif(b: BaremeSubvention, brut: number): number {
  return b.pourcentage !== undefined ? b.plafondParVehicule : brut;
}

export function resoudreSubventions(
  d: DemandeSubventions,
  programmes: ProgrammeSubvention[] = PROGRAMMES,
): ResolutionSubventions {
  if (!Number.isFinite(d.prixAvantTaxes) || d.prixAvantTaxes <= 0) {
    throw new Error('prixAvantTaxes invalide');
  }
  const retenues: { sub: SubventionAppliquee; prog: ProgrammeSubvention }[] = [];
  const avertissements: string[] = [];

  for (const prog of programmes) {
    if (prog.statut !== 'actif' || prog.cible !== 'vehicule') continue;
    if (!prog.organismesAdmissibles.includes(d.typeOrganisme)) continue;
    if (!admissibleSpecifique(prog, d)) continue;
    if (
      d.anneeAchatCalendaire !== undefined &&
      prog.dateFin !== undefined &&
      Number(prog.dateFin.slice(0, 4)) < d.anneeAchatCalendaire
    ) {
      continue; // programme échu avant l'année d'achat prévue
    }

    // Barèmes admissibles : catégorie, technologie et classe de poids.
    const candidats: { bareme: BaremeSubvention; montant: number }[] = [];
    let baremesParClasse = 0;
    for (const b of prog.baremes) {
      if (!b.categories.includes(d.categorie) || !b.technologies.includes(d.technologie)) continue;
      if (b.classesPoids) {
        baremesParClasse += 1;
        if (d.classePoids !== undefined && !b.classesPoids.includes(d.classePoids)) continue;
      }
      const brut = montantBrut(b, d);
      if (brut === null || brut <= 0) continue;
      let montant = brut;
      if (d.fabriqueAuQuebec && prog.bonificationAchatLocal) {
        // Bonification DANS le plafond (lecture prudente des modalités).
        montant = Math.min(brut * (1 + prog.bonificationAchatLocal), plafondEffectif(b, brut));
      }
      candidats.push({ bareme: b, montant });
    }
    if (candidats.length === 0) continue;

    // Classe connue (ou un seul barème possible) : le meilleur barème
    // admissible. Classe INCONNUE avec plusieurs barèmes par classe : le
    // barème LE PLUS BAS (jamais le plus élevé) + avertissement.
    let choisi = candidats[0];
    if (d.classePoids !== undefined || candidats.length === 1) {
      for (const c of candidats) if (c.montant > choisi.montant) choisi = c;
    } else {
      for (const c of candidats) if (c.montant < choisi.montant) choisi = c;
      if (baremesParClasse >= 2) {
        avertissements.push(
          `${prog.nom} : classe de poids (PNBV) du véhicule inconnue — barème le plus bas des classes ` +
            `possibles retenu par prudence (${Math.round(choisi.montant).toLocaleString('fr-CA')} $). ` +
            `Renseignez la classe de poids pour obtenir le barème exact.`,
        );
      }
    }

    if (choisi.bareme.pourcentageAValider) {
      avertissements.push(
        `${prog.nom} : le pourcentage du coût d'achat appliqué (${Math.round(
          (choisi.bareme.pourcentage ?? 0) * 100,
        )} %, borne basse prudente) est À VALIDER — la cellule correspondante du tableau officiel est vide.`,
      );
    }
    if (prog.id === 'pave') {
      avertissements.push(
        'PAVÉ : barème dégressif — le montant dépend de la date de soumission de la demande par le ' +
          'concessionnaire, pas de la date d’achat ; limite de 10 incitatifs par organisation (dont les ' +
          'municipalités) sur la durée du programme.',
      );
    }
    if (prog.id === 'ecocamionnage_v1') {
      if (choisi.bareme.classesPoids && !choisi.bareme.classesPoids.includes('2b')) {
        avertissements.push(
          'Écocamionnage : inscription au Registre des propriétaires et exploitants de véhicules lourds ' +
            '(RPEVL) avec cote de sécurité satisfaisante requise (sauf fourgonnettes classe 2b) ; plafond ' +
            'de 3 M$ d’aide par demandeur par année financière pour les acquisitions.',
        );
      }
    }

    retenues.push({
      sub: { libelle: prog.nom, montant: choisi.montant, annee: prog.anneeVersementDefaut },
      prog,
    });
  }

  // Plafond de CUMUL des aides publiques d'un programme (ex. Écocamionnage
  // art. 7.14.2 : 75 % des dépenses admissibles) : l'excédent est déduit
  // de l'aide de CE programme.
  for (const r of retenues) {
    const pct = r.prog.plafondCumulAidePubliquePct;
    if (pct === undefined) continue;
    const total = retenues.reduce((a, x) => a + x.sub.montant, 0);
    const plafond = pct * d.prixAvantTaxes;
    if (total > plafond) {
      const reduction = Math.min(r.sub.montant, total - plafond);
      r.sub.montant -= reduction;
      if (reduction > 0) {
        avertissements.push(
          `${r.prog.nom} : aide réduite de ${Math.round(reduction).toLocaleString('fr-CA')} $ pour ` +
            `respecter le plafond de cumul des aides publiques (${Math.round(pct * 100)} % des dépenses ` +
            `admissibles, art. 7.14.2).`,
        );
      }
    }
  }

  // Cumul global : le total ne dépasse jamais le coût admissible — on
  // tronque en commençant par les montants les plus faibles pour
  // préserver l'aide principale.
  const subventions = retenues.map((r) => r.sub);
  const total = subventions.reduce((a, s) => a + s.montant, 0);
  if (total > d.prixAvantTaxes) {
    subventions.sort((a, b) => b.montant - a.montant);
    let budget = d.prixAvantTaxes;
    for (const s of subventions) {
      s.montant = Math.min(s.montant, Math.max(budget, 0));
      budget -= s.montant;
    }
  }
  return { subventions: subventions.filter((s) => s.montant > 0), avertissements };
}

/** Variante « montants seulement » (compatibilité) : voir
 *  `resoudreSubventions` pour récupérer aussi les avertissements. */
export function resoudreSubventionsVehicule(
  d: DemandeSubventions,
  programmes: ProgrammeSubvention[] = PROGRAMMES,
): SubventionAppliquee[] {
  return resoudreSubventions(d, programmes).subventions;
}
