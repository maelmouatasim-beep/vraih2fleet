/**
 * Moteur TCO — implémentation PURE de docs/tco-methodologie.md.
 *
 * - Aucune date implicite, aucun réseau, aucune base : tout vient de
 *   l'entrée validée (zod) ; NaN/Infinity impossibles par validation.
 * - Flux NOMINAUX par année (0..H), actualisés au taux NOMINAL.
 * - La référence (statu quo diesel) est calculée par LE MÊME code que
 *   l'alternative : seule la spécification du véhicule change.
 * - Précision : calculs en pleine précision ; l'arrondi n'existe qu'à
 *   l'affichage (les tests de référence tolèrent ±0,01 $).
 */

import { ENGINE_VERSION, empreinte } from './fingerprint';
import type {
  FluxAnnuels,
  LigneBudgetaire,
  ParametresProjet,
  PartInfraVehicule,
  Payback,
  PlanTco,
  PlanTcoEntree,
  ResultatPlan,
  ResultatScenario,
  SpecVehicule,
  VehiculePlan,
} from './types';
import { zPlanTco } from './types';

type NomScenario = 'alternative' | 'reference';

function fluxVides(h: number): FluxAnnuels {
  const zero = () => new Array<number>(h + 1).fill(0);
  return {
    investissement: zero(),
    subventions: zero(),
    energie: zero(),
    entretien: zero(),
    assurance: zero(),
    evenements: zero(),
    opexInfra: zero(),
    residuels: zero(),
    net: zero(),
  };
}

/** Valeur résiduelle géométrique planchée (§3.7) — MÊME méthode en fin
 *  de vie (reprise au re-remplacement) et en fin d'horizon (§10.2 v2.0). */
function ratioResiduel(depreciation: number, age: number, plancher: number): number {
  return Math.max(Math.pow(1 - depreciation, age), plancher);
}

/** Années d'achat d'un véhicule sur l'horizon (début, début+durée, … < H). */
function anneesAchat(dureeVieAns: number, horizon: number, debut: number): number[] {
  const achats: number[] = [];
  for (let p = debut; p < horizon; p += dureeVieAns) achats.push(p);
  return achats;
}

/** Énergie annuelle facturée d'un véhicule, dans l'unité native de sa
 *  technologie (L, kWh AU COMPTEUR, ou kg H2), majoration hivernale et
 *  rendement de recharge inclus. */
export function energieAnnuelleFacturee(spec: SpecVehicule, kmParAn: number, p: ParametresProjet): number {
  const base = (kmParAn * spec.consommationPar100km) / 100;
  if (spec.technologie === 'diesel') return base;
  const majoree = base * (1 + p.majorationHivernaleAnnualisee);
  return spec.technologie === 'BEV' ? majoree / p.rendementRecharge : majoree;
}

function prixEnergieAnnee(spec: SpecVehicule, p: ParametresProjet, annee: number): number {
  switch (spec.technologie) {
    case 'diesel':
      return p.prixAnnee0.dieselParL * Math.pow(1 + p.inflations.diesel, annee);
    case 'BEV':
      return p.prixAnnee0.electriciteEffectiveParKwh * Math.pow(1 + p.inflations.electricite, annee);
    case 'FCEV':
      return p.prixAnnee0.h2LivreParKg * Math.pow(1 + p.inflations.hydrogene, annee);
  }
}

/** Émissions annuelles (t CO2e) d'un véhicule : [TTW, WTW]. */
function emissionsAnnuelles(
  spec: SpecVehicule,
  vehicule: VehiculePlan,
  p: ParametresProjet,
): [ttw: number, wtw: number] {
  const energie = energieAnnuelleFacturee(spec, vehicule.kmParAn, p);
  switch (spec.technologie) {
    case 'diesel': {
      const fe =
        vehicule.classeEmissionDiesel === 'legers'
          ? p.facteursEmission.dieselTtwLegersKgParL
          : p.facteursEmission.dieselTtwLourdsKgParL;
      const ttw = (energie * fe) / 1000;
      return [ttw, ttw * p.facteursEmission.ratioWtwDiesel];
    }
    case 'BEV':
      return [0, (energie * p.facteursEmission.electriciteGParKwh) / 1_000_000];
    case 'FCEV':
      return [0, (energie * p.facteursEmission.h2KgParKg) / 1000];
  }
}

function ajouterVehiculeAuScenario(
  flux: FluxAnnuels,
  vehicule: VehiculePlan,
  nom: NomScenario,
  p: ParametresProjet,
  avertissements: string[],
): { ttw: number; wtw: number } {
  const h = p.horizonAns;
  const debut = vehicule.anneeAcquisition;
  const spec = nom === 'alternative' ? vehicule.alternative : vehicule.reference;
  const taxes = 1 + p.tauxTaxesNonRecuperables;
  const depreciation = p.depreciationAnnuelle[spec.technologie];

  // Acquisition différée (§10.11) : au-delà de l'horizon, le véhicule ne
  // contribue à aucun des deux scénarios (différentiel nul partout).
  if (debut >= h) {
    if (nom === 'alternative') {
      avertissements.push(
        `${vehicule.id} : année d'acquisition (${debut}) hors de l'horizon H=${h} — véhicule sans effet sur le plan`,
      );
    }
    return { ttw: 0, wtw: 0 };
  }

  // Achats et re-remplacements (docs/tco-methodologie.md §3.8) : le prix
  // d'un achat futur est indexé à l'inflation générale (trajectoire
  // technologique désactivée par défaut) ; le véhicule remplacé en fin de
  // vie est repris à sa valeur plancher ; le dernier véhicule est crédité
  // de sa valeur résiduelle géométrique (planchée) en fin d'horizon.
  const achats = anneesAchat(vehicule.dureeVieAns, h, debut);
  let prixBasePrecedent = 0;
  let dernierAchat = debut;
  let prixBaseDernier = 0;
  for (const annee of achats) {
    const prixBase = spec.prixAvantTaxes * Math.pow(1 + p.inflations.generale, annee);
    flux.investissement[annee] += prixBase * taxes;
    if (annee > debut) {
      // Reprise du véhicule remplacé à sa VR géométrique planchée (même
      // méthode qu'en fin d'horizon — §10.2 v2.0).
      flux.residuels[annee] += ratioResiduel(depreciation, vehicule.dureeVieAns, p.plancherResiduel) * prixBasePrecedent;
    }
    prixBasePrecedent = prixBase;
    dernierAchat = annee;
    prixBaseDernier = prixBase;
  }
  flux.residuels[h] += ratioResiduel(depreciation, h - dernierAchat, p.plancherResiduel) * prixBaseDernier;

  // Subventions à leur année de versement (alternative seulement : la
  // référence diesel n'en reçoit pas).
  if (nom === 'alternative') {
    for (const s of vehicule.subventionsAlternative) {
      if (s.annee > h) {
        avertissements.push(
          `${vehicule.id} : subvention « ${s.libelle} » versée après l'horizon (année ${s.annee}) — ignorée`,
        );
        continue;
      }
      flux.subventions[s.annee] += s.montant;
    }
  }

  // Exploitation, années début+1..H (avant l'acquisition, le véhicule
  // actuel est identique dans les deux scénarios : différentiel nul).
  const energieAnnuelle = energieAnnuelleFacturee(spec, vehicule.kmParAn, p);
  for (let n = debut + 1; n <= h; n++) {
    flux.energie[n] += energieAnnuelle * prixEnergieAnnee(spec, p, n);
    flux.entretien[n] += vehicule.kmParAn * spec.entretienParKm * Math.pow(1 + p.inflations.entretien, n);
    // Assurance/immatriculation (§3.6) : $/an fournis, indexés à
    // l'inflation générale ; 0 si non fournis.
    flux.assurance[n] += spec.assuranceParAn * Math.pow(1 + p.inflations.generale, n);
  }
  for (const ev of spec.evenements) {
    if (ev.annee > h) continue;
    // Coût daté saisi en dollars courants de son année (devis) : ni taxes
    // ajoutées, ni indexation (méthodologie §3.4).
    flux.evenements[ev.annee] += ev.coutAvantTaxes;
  }

  const [ttwAnnuel, wtwAnnuel] = emissionsAnnuelles(spec, vehicule, p);
  return { ttw: ttwAnnuel * (h - debut), wtw: wtwAnnuel * (h - debut) };
}

function ajouterInfra(
  flux: FluxAnnuels,
  plan: PlanTco,
  avertissements: string[],
): PartInfraVehicule[] {
  const p = plan.parametres;
  const h = p.horizonAns;
  const taxes = 1 + p.tauxTaxesNonRecuperables;
  const parts: PartInfraVehicule[] = [];

  for (const site of plan.sitesInfra) {
    const debut = site.anneeMiseEnService;
    if (debut >= h) {
      avertissements.push(
        `site ${site.id} : mise en service (${debut}) hors de l'horizon H=${h} — site sans effet sur le plan`,
      );
      continue;
    }
    // Capex à l'année de mise en service (indexé à l'inflation générale,
    // §3.8), puis RÉINVESTISSEMENT en fin de durée de vie tant que
    // l'horizon la dépasse (§3.5 v2.0) ; l'équipement remplacé atteint
    // exactement sa fin de vie (VR linéaire nulle) ; le dernier est
    // crédité de sa VR linéaire en fin d'horizon.
    const achats = anneesAchat(p.infra.dureeVieAns, h, debut);
    let dernierAchat = debut;
    let capexDernier = 0;
    for (const annee of achats) {
      const capexIndexe = site.capexAvantTaxes * Math.pow(1 + p.inflations.generale, annee);
      flux.investissement[annee] += capexIndexe * taxes;
      dernierAchat = annee;
      capexDernier = capexIndexe;
    }
    const ageFin = h - dernierAchat;
    if (ageFin < p.infra.dureeVieAns) {
      flux.residuels[h] += (capexDernier * (p.infra.dureeVieAns - ageFin)) / p.infra.dureeVieAns;
    }
    for (const s of site.subventions) {
      if (s.annee > h) {
        avertissements.push(`site ${site.id} : subvention « ${s.libelle} » après l'horizon — ignorée`);
        continue;
      }
      flux.subventions[s.annee] += s.montant;
    }
    for (let n = debut + 1; n <= h; n++) {
      flux.opexInfra[n] +=
        site.capexAvantTaxes * p.infra.entretienAnnuelPctCapex * Math.pow(1 + p.inflations.entretien, n);
    }

    // Répartition par véhicule : au prorata de l'énergie facturée de
    // l'année 1 (unités natives) si les technologies du site sont
    // homogènes ; sinon parts égales + avertissement (§3.5).
    const vehicules = site.vehiculeIds.map((id) => {
      const v = plan.vehicules.find((x) => x.id === id);
      if (!v) throw new Error(`site ${site.id} : véhicule inconnu « ${id} »`);
      return v;
    });
    const technos = new Set(vehicules.map((v) => v.alternative.technologie));
    let poids: number[];
    if (technos.size === 1) {
      poids = vehicules.map((v) => energieAnnuelleFacturee(v.alternative, v.kmParAn, p));
    } else {
      poids = vehicules.map(() => 1);
      avertissements.push(`site ${site.id} : technologies mixtes — répartition en parts égales`);
    }
    const total = poids.reduce((a, b) => a + b, 0);
    for (let i = 0; i < vehicules.length; i++) {
      parts.push({ vehiculeId: vehicules[i].id, siteId: site.id, part: (site.capexAvantTaxes * poids[i]) / total });
    }
  }
  return parts;
}

function finaliserScenario(flux: FluxAnnuels, ttw: number, wtw: number, p: ParametresProjet): ResultatScenario {
  const h = p.horizonAns;
  let tco = 0;
  for (let n = 0; n <= h; n++) {
    flux.net[n] =
      flux.investissement[n] +
      flux.energie[n] +
      flux.entretien[n] +
      flux.assurance[n] +
      flux.evenements[n] +
      flux.opexInfra[n] -
      flux.subventions[n] -
      flux.residuels[n];
    tco += flux.net[n] / Math.pow(1 + p.tauxActualisationNominal, n);
  }
  return { flux, tcoActualise: tco, emissionsTtwTonnes: ttw, emissionsWtwTonnes: wtw };
}

function calculerPayback(diffs: number[], actualise: boolean, p: ParametresProjet): Payback {
  const h = p.horizonAns;
  let cumul = 0;
  let economieMax = -Infinity;
  for (let n = 0; n <= h; n++) {
    const d = actualise ? diffs[n] / Math.pow(1 + p.tauxActualisationNominal, n) : diffs[n];
    cumul += d;
    if (n >= 1) economieMax = Math.max(economieMax, d);
    if (cumul >= -1e-6) return { annees: n, raison: null };
  }
  const raison =
    economieMax <= 0
      ? 'les économies annuelles sont nulles ou négatives'
      : `le surcoût n'est pas résorbé à l'horizon H=${h}`;
  return { annees: null, raison };
}

/** Point d'entrée du moteur. L'entrée est validée (zod) ; toute entrée
 *  invalide lève une erreur explicite. */
export function calculerPlan(entree: PlanTcoEntree): ResultatPlan {
  const plan: PlanTco = zPlanTco.parse(entree);
  const p = plan.parametres;
  const h = p.horizonAns;
  const avertissements: string[] = [];

  const ids = new Set(plan.vehicules.map((v) => v.id));
  if (ids.size !== plan.vehicules.length) throw new Error('identifiants de véhicules en double');

  const fluxAlt = fluxVides(h);
  const fluxRef = fluxVides(h);
  let ttwAlt = 0;
  let wtwAlt = 0;
  let ttwRef = 0;
  let wtwRef = 0;

  for (const v of plan.vehicules) {
    const ea = ajouterVehiculeAuScenario(fluxAlt, v, 'alternative', p, avertissements);
    ttwAlt += ea.ttw;
    wtwAlt += ea.wtw;
    const er = ajouterVehiculeAuScenario(fluxRef, v, 'reference', p, avertissements);
    ttwRef += er.ttw;
    wtwRef += er.wtw;
  }

  // L'infrastructure de recharge n'existe que dans l'alternative (§4).
  const partsInfra = ajouterInfra(fluxAlt, plan, avertissements);

  const alternative = finaliserScenario(fluxAlt, ttwAlt, wtwAlt, p);
  const reference = finaliserScenario(fluxRef, ttwRef, wtwRef, p);

  const vanDifferentielle = reference.tcoActualise - alternative.tcoActualise;

  // Kilomètres actualisés : chaque véhicule ne roule (dans le plan) qu'à
  // partir de l'année suivant son acquisition (§10.11).
  let kmActualises = 0;
  for (const v of plan.vehicules) {
    for (let n = v.anneeAcquisition + 1; n <= h; n++) {
      kmActualises += v.kmParAn / Math.pow(1 + p.tauxActualisationNominal, n);
    }
  }

  const diffs = reference.flux.net.map((r, n) => r - alternative.flux.net[n]);
  const paybackSimple = calculerPayback(diffs, false, p);
  const paybackActualise = calculerPayback(diffs, true, p);

  const co2EviteTtwTonnes = reference.emissionsTtwTonnes - alternative.emissionsTtwTonnes;
  const co2EviteWtwTonnes = reference.emissionsWtwTonnes - alternative.emissionsWtwTonnes;
  const coutParTonneWtw =
    co2EviteWtwTonnes > 1e-9 ? (alternative.tcoActualise - reference.tcoActualise) / co2EviteWtwTonnes : null;

  const vueBudgetaire: LigneBudgetaire[] = [];
  for (let n = 0; n <= h; n++) {
    const fonctionnementAlt =
      alternative.flux.energie[n] +
      alternative.flux.entretien[n] +
      alternative.flux.assurance[n] +
      alternative.flux.evenements[n] +
      alternative.flux.opexInfra[n];
    vueBudgetaire.push({
      annee: p.anneeReference + n,
      investissementAlt: alternative.flux.investissement[n],
      fonctionnementAlt,
      subventionsAlt: alternative.flux.subventions[n],
      residuelsAlt: alternative.flux.residuels[n],
      resteAFinancerAlt: alternative.flux.investissement[n] - alternative.flux.subventions[n],
      netAlt: alternative.flux.net[n],
      netRef: reference.flux.net[n],
      ecart: reference.flux.net[n] - alternative.flux.net[n],
    });
  }

  return {
    engineVersion: ENGINE_VERSION,
    empreinteEntree: empreinte(plan),
    horizonAns: h,
    alternative,
    reference,
    vanDifferentielle,
    kmActualises,
    tcoParKmAlt: kmActualises > 0 ? alternative.tcoActualise / kmActualises : 0,
    paybackSimple,
    paybackActualise,
    co2EviteTtwTonnes,
    co2EviteWtwTonnes,
    coutParTonneWtw,
    vueBudgetaire,
    partsInfra,
    avertissements,
  };
}
