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

/** Pourquoi un programme donne 0 $ ou un montant réduit (revue 1.7) —
 *  structuré pour être traduit à l'affichage (écran, PDF, Excel). */
export type RaisonSubvention =
  | { code: 'programme_ferme'; statut: 'ferme' | 'suspendu' }
  | { code: 'organisme_non_admissible' }
  | { code: 'prix_plafond'; plafond: number; prix: number; inclusif: boolean }
  | { code: 'programme_echu'; dateFin: string; anneeAchat: number }
  | { code: 'classe_non_couverte'; classe: ClassePoids }
  | { code: 'bareme_nul_annee'; classes: ClassePoids[] | null; anneeAchat: number }
  | { code: 'classe_inconnue'; classes: ClassePoids[] | null; montant: number }
  | { code: 'montant_par_projet' }
  | { code: 'cumul_aides'; reduction: number; pct: number }
  | { code: 'plafond_cout'; reduction: number }
  | { code: 'pourcentage_a_valider'; pct: number };

/** Règle appliquée par le barème retenu. */
export interface RegleSubvention {
  type: 'forfait' | 'pourcentage';
  /** Montant du barème avant plafonds de cumul (bonification comprise). */
  montant: number;
  pourcentage?: number;
  /** Prix avant taxes auquel s'applique le pourcentage. */
  base?: number;
  plafond?: number;
  /** Classes de poids couvertes par le barème retenu (null = sans classe). */
  classes: ClassePoids[] | null;
  /** Année d'achat utilisée pour un barème dégressif. */
  anneeAchat: number | null;
  bonificationPct?: number;
}

/** Une ligne par programme PERTINENT (catégorie et technologie couvertes),
 *  retenu ou non : « règle appliquée » + « raison » si 0 $ ou réduit. */
export interface ExplicationSubvention {
  programmeId: string;
  programme: string;
  montant: number;
  statut: 'retenue' | 'reduite' | 'exclue';
  regle: RegleSubvention | null;
  raisons: RaisonSubvention[];
}

export interface ResolutionSubventions {
  subventions: SubventionAppliquee[];
  /** Conditions et prudences à montrer à l'utilisateur (classe de poids
   *  inconnue, % à valider, limites par organisation, RPEVL/CTQ…). */
  avertissements: string[];
  /** Règle et raison, programme par programme (revue 1.7). */
  explications: ExplicationSubvention[];
}

/** Règles d'admissibilité propres à un programme, non exprimables par le
 *  seul barème (documentées dans le registre). Renvoie la raison du refus. */
function refusSpecifique(prog: ProgrammeSubvention, d: DemandeSubventions): RaisonSubvention | null {
  if (prog.id === 'pave') {
    // Transaction ≤ 50 000 $, sauf véhicule fabriqué au Canada (vérifié).
    return d.prixAvantTaxes <= 50000 || d.fabriqueAuCanada === true
      ? null
      : { code: 'prix_plafond', plafond: 50000, prix: d.prixAvantTaxes, inclusif: true };
  }
  if (prog.id === 'roulez_vert') {
    // PDSF < 65 000 $ (vérifié).
    return d.prixAvantTaxes < 65000
      ? null
      : { code: 'prix_plafond', plafond: 65000, prix: d.prixAvantTaxes, inclusif: false };
  }
  return null;
}

/** Montant BRUT d'un barème (avant bonification) : un nombre (0 compris
 *  quand le barème dégressif ne verse plus rien l'année d'achat), ou
 *  'projet' si le montant est à saisir par projet (jamais automatique). */
function montantBrut(b: BaremeSubvention, d: DemandeSubventions): number | 'projet' {
  // Forfait dégressif selon l'année calendaire d'achat : une année absente
  // du barème (après sa dernière année) vaut 0 $, jamais un autre barème.
  if (b.montantParAnneeAchat && d.anneeAchatCalendaire !== undefined) {
    return Math.max(0, b.montantParAnneeAchat[d.anneeAchatCalendaire] ?? 0);
  }
  if (b.plafondParVehicule <= 0) return 'projet';
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
  const retenues: { sub: SubventionAppliquee; prog: ProgrammeSubvention; expl: ExplicationSubvention }[] = [];
  const avertissements: string[] = [];
  const explications: ExplicationSubvention[] = [];
  const exclure = (prog: ProgrammeSubvention, raisons: RaisonSubvention[], regle: RegleSubvention | null = null) =>
    explications.push({ programmeId: prog.id, programme: prog.nom, montant: 0, statut: 'exclue', regle, raisons });

  for (const prog of programmes) {
    if (prog.cible !== 'vehicule') continue;
    const baremesPertinents = prog.baremes.filter(
      (b) => b.categories.includes(d.categorie) && b.technologies.includes(d.technologie),
    );
    if (baremesPertinents.length === 0) continue; // programme sans rapport avec ce véhicule

    if (prog.statut !== 'actif') {
      exclure(prog, [{ code: 'programme_ferme', statut: prog.statut }]);
      continue;
    }
    if (!prog.organismesAdmissibles.includes(d.typeOrganisme)) {
      exclure(prog, [{ code: 'organisme_non_admissible' }]);
      continue;
    }
    const refus = refusSpecifique(prog, d);
    if (refus) {
      exclure(prog, [refus]);
      continue;
    }
    if (
      d.anneeAchatCalendaire !== undefined &&
      prog.dateFin !== undefined &&
      Number(prog.dateFin.slice(0, 4)) < d.anneeAchatCalendaire
    ) {
      exclure(prog, [{ code: 'programme_echu', dateFin: prog.dateFin, anneeAchat: d.anneeAchatCalendaire }]);
      continue;
    }

    // Barèmes admissibles : catégorie, technologie et classe de poids.
    const candidats: { bareme: BaremeSubvention; montant: number }[] = [];
    let baremesParClasse = 0;
    let parProjet = 0;
    for (const b of baremesPertinents) {
      if (b.classesPoids) {
        baremesParClasse += 1;
        if (d.classePoids !== undefined && !b.classesPoids.includes(d.classePoids)) continue;
      }
      const brut = montantBrut(b, d);
      if (brut === 'projet') {
        parProjet += 1;
        continue;
      }
      let montant = brut;
      if (brut > 0 && d.fabriqueAuQuebec && prog.bonificationAchatLocal) {
        // Bonification DANS le plafond (lecture prudente des modalités).
        montant = Math.min(brut * (1 + prog.bonificationAchatLocal), plafondEffectif(b, brut));
      }
      candidats.push({ bareme: b, montant });
    }
    if (candidats.length === 0) {
      exclure(
        prog,
        parProjet > 0
          ? [{ code: 'montant_par_projet' }]
          : [{ code: 'classe_non_couverte', classe: d.classePoids as ClassePoids }],
      );
      continue;
    }

    // Classe connue (ou un seul barème possible) : le meilleur barème
    // admissible. Classe INCONNUE avec plusieurs barèmes par classe : le
    // barème LE PLUS BAS — 0 $ compris (barème dégressif échu) — jamais le
    // plus élevé, avec avertissement. Deux véhicules identiques achetés la
    // même année reçoivent donc toujours le même montant.
    let choisi = candidats[0];
    const raisons: RaisonSubvention[] = [];
    if (d.classePoids !== undefined || candidats.length === 1) {
      for (const c of candidats) if (c.montant > choisi.montant) choisi = c;
    } else {
      for (const c of candidats) if (c.montant < choisi.montant) choisi = c;
      if (baremesParClasse >= 2) {
        raisons.push({ code: 'classe_inconnue', classes: choisi.bareme.classesPoids ?? null, montant: choisi.montant });
        avertissements.push(
          `${prog.nom} : classe de poids (PNBV) du véhicule inconnue — barème le plus bas des classes ` +
            `possibles retenu par prudence (${Math.round(choisi.montant).toLocaleString('fr-CA')} $). ` +
            `Renseignez la classe de poids pour obtenir le barème exact.`,
        );
      }
    }

    const b = choisi.bareme;
    const regle: RegleSubvention = {
      type: b.pourcentage !== undefined && !(b.montantParAnneeAchat && d.anneeAchatCalendaire !== undefined)
        ? 'pourcentage'
        : 'forfait',
      montant: choisi.montant,
      classes: b.classesPoids ?? null,
      anneeAchat: b.montantParAnneeAchat && d.anneeAchatCalendaire !== undefined ? d.anneeAchatCalendaire : null,
    };
    if (regle.type === 'pourcentage') {
      regle.pourcentage = b.pourcentage;
      regle.base = d.prixAvantTaxes;
      regle.plafond = b.plafondParVehicule;
    }
    if (choisi.montant > 0 && d.fabriqueAuQuebec && prog.bonificationAchatLocal) {
      regle.bonificationPct = prog.bonificationAchatLocal;
    }

    if (choisi.montant <= 0) {
      exclure(
        prog,
        [{ code: 'bareme_nul_annee', classes: b.classesPoids ?? null, anneeAchat: d.anneeAchatCalendaire ?? 0 }, ...raisons],
        regle,
      );
      continue;
    }

    if (b.pourcentageAValider) {
      raisons.push({ code: 'pourcentage_a_valider', pct: b.pourcentage ?? 0 });
      avertissements.push(
        `${prog.nom} : pourcentage du coût d'achat retenu de ${Math.round(
          (b.pourcentage ?? 0) * 100,
        )} % (valeur prudente), à confirmer auprès du programme — le tableau officiel ne le précise pas pour cette classe.`,
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
      if (b.classesPoids && !b.classesPoids.includes('2b')) {
        avertissements.push(
          'Écocamionnage : l’organisme doit être inscrit au registre des véhicules lourds de la Commission ' +
            'des transports du Québec (RPEVL) avec une cote de sécurité satisfaisante (sauf fourgonnettes de ' +
            'classe 2b) ; aide plafonnée à 3 M$ par demandeur et par année financière.',
        );
      }
    }

    const expl: ExplicationSubvention = {
      programmeId: prog.id,
      programme: prog.nom,
      montant: choisi.montant,
      statut: 'retenue',
      regle,
      raisons,
    };
    explications.push(expl);
    retenues.push({
      sub: { libelle: prog.nom, montant: choisi.montant, annee: prog.anneeVersementDefaut },
      prog,
      expl,
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
      // total > plafond et montant > 0 ⇒ réduction strictement positive
      r.sub.montant -= reduction;
      r.expl.raisons.push({ code: 'cumul_aides', reduction, pct });
      avertissements.push(
        `${r.prog.nom} : aide réduite de ${Math.round(reduction).toLocaleString('fr-CA')} $ pour ` +
          `respecter le plafond de cumul des aides publiques (${Math.round(pct * 100)} % des dépenses ` +
          `admissibles, art. 7.14.2).`,
      );
    }
  }

  // Cumul global : le total ne dépasse jamais le coût admissible — on
  // tronque en commençant par les montants les plus faibles pour
  // préserver l'aide principale.
  const total = retenues.reduce((a, r) => a + r.sub.montant, 0);
  if (total > d.prixAvantTaxes) {
    const tries = [...retenues].sort((a, b) => b.sub.montant - a.sub.montant);
    let budget = d.prixAvantTaxes;
    for (const r of tries) {
      const avant = r.sub.montant;
      r.sub.montant = Math.min(avant, Math.max(budget, 0));
      budget -= r.sub.montant;
      if (r.sub.montant < avant) r.expl.raisons.push({ code: 'plafond_cout', reduction: avant - r.sub.montant });
    }
  }
  for (const r of retenues) {
    r.expl.montant = r.sub.montant;
    if (r.sub.montant <= 0) r.expl.statut = 'exclue';
    else if (r.expl.raisons.some((x) => x.code === 'cumul_aides' || x.code === 'plafond_cout')) r.expl.statut = 'reduite';
  }
  const subventions = [...retenues].map((r) => r.sub);
  if (total > d.prixAvantTaxes) subventions.sort((a, b) => b.montant - a.montant);
  return { subventions: subventions.filter((s) => s.montant > 0), avertissements, explications };
}

/** Variante « montants seulement » (compatibilité) : voir
 *  `resoudreSubventions` pour récupérer aussi les avertissements. */
export function resoudreSubventionsVehicule(
  d: DemandeSubventions,
  programmes: ProgrammeSubvention[] = PROGRAMMES,
): SubventionAppliquee[] {
  return resoudreSubventions(d, programmes).subventions;
}
