/**
 * CONTRE-CALCULATEUR indépendant des cas de référence.
 *
 * Implémentation NAÏVE et lisible de docs/tco-methodologie.md, année
 * par année, volontairement distincte de src/lib/tco/engine.ts (aucun
 * import du moteur) : les deux implémentations doivent s'accorder au
 * cent près, sinon l'une des deux (ou la méthodologie) a tort.
 * Tout changement de méthode doit être appliqué ICI ET dans le moteur,
 * dans le même commit, avec la régénération du JSON.
 */

/** Flux d'un scénario (alt ou ref) : tableaux indexés 0..H. */
function fluxVides(h) {
  const zero = () => new Array(h + 1).fill(0);
  return {
    investissement: zero(),
    subventions: zero(),
    energie: zero(),
    entretien: zero(),
    evenements: zero(),
    opexInfra: zero(),
    residuels: zero(),
    net: zero(),
  };
}

/** Énergie annuelle facturée (unité native), majoration hivernale et
 *  rendement de recharge inclus (§3.3). */
function energieAnnuelle(spec, kmParAn, p) {
  const base = (kmParAn * spec.consommationPar100km) / 100;
  if (spec.technologie === 'diesel') return base;
  const majoree = base * (1 + p.majorationHivernaleAnnualisee);
  return spec.technologie === 'BEV' ? majoree / p.rendementRecharge : majoree;
}

function prixEnergie(spec, p, n) {
  if (spec.technologie === 'diesel') return p.prixAnnee0.dieselParL * (1 + p.inflations.diesel) ** n;
  if (spec.technologie === 'BEV') {
    return p.prixAnnee0.electriciteEffectiveParKwh * (1 + p.inflations.electricite) ** n;
  }
  return p.prixAnnee0.h2LivreParKg * (1 + p.inflations.hydrogene) ** n;
}

/** Émissions annuelles [TTW, WTW] en tonnes (§5). */
function emissionsAnnuelles(spec, vehicule, p) {
  const e = energieAnnuelle(spec, vehicule.kmParAn, p);
  if (spec.technologie === 'diesel') {
    const fe =
      vehicule.classeEmissionDiesel === 'legers'
        ? p.facteursEmission.dieselTtwLegersKgParL
        : p.facteursEmission.dieselTtwLourdsKgParL;
    const ttw = (e * fe) / 1000;
    return [ttw, ttw * p.facteursEmission.ratioWtwDiesel];
  }
  if (spec.technologie === 'BEV') return [0, (e * p.facteursEmission.electriciteGParKwh) / 1e6];
  return [0, (e * p.facteursEmission.h2KgParKg) / 1000];
}

/** Ajoute un véhicule (spec = alternative ou référence) aux flux. */
function ajouterVehicule(flux, vehicule, spec, estAlternative, p) {
  const h = p.horizonAns;
  const debut = vehicule.anneeAcquisition ?? 0;
  if (debut >= h) return { ttw: 0, wtw: 0 };
  const taxes = 1 + p.tauxTaxesNonRecuperables;
  const dep = p.depreciationAnnuelle[spec.technologie];

  // Achats et re-remplacements (§3.8) : prix indexé à l'inflation
  // générale ; reprise du véhicule remplacé à la valeur plancher ;
  // dernier véhicule crédité de sa VR géométrique planchée en fin
  // d'horizon (§3.7, §10.2).
  const achats = [];
  for (let a = debut; a < h; a += vehicule.dureeVieAns) achats.push(a);
  let prixPrecedent = 0;
  let dernier = debut;
  let prixDernier = 0;
  for (const a of achats) {
    const prixBase = spec.prixAvantTaxes * (1 + p.inflations.generale) ** a;
    flux.investissement[a] += prixBase * taxes;
    if (a > debut) flux.residuels[a] += p.plancherResiduel * prixPrecedent;
    prixPrecedent = prixBase;
    dernier = a;
    prixDernier = prixBase;
  }
  const ratioFin = Math.max((1 - dep) ** (h - dernier), p.plancherResiduel);
  flux.residuels[h] += ratioFin * prixDernier;

  if (estAlternative) {
    for (const s of vehicule.subventionsAlternative ?? []) {
      if (s.annee <= h) flux.subventions[s.annee] += s.montant;
    }
  }

  const e = energieAnnuelle(spec, vehicule.kmParAn, p);
  for (let n = debut + 1; n <= h; n++) {
    flux.energie[n] += e * prixEnergie(spec, p, n);
    flux.entretien[n] += vehicule.kmParAn * spec.entretienParKm * (1 + p.inflations.entretien) ** n;
  }
  for (const ev of spec.evenements ?? []) {
    if (ev.annee <= h) flux.evenements[ev.annee] += ev.coutAvantTaxes;
  }

  const [ttw, wtw] = emissionsAnnuelles(spec, vehicule, p);
  return { ttw: ttw * (h - debut), wtw: wtw * (h - debut) };
}

/** Infrastructure (§3.5) : capex au point 0 (alternative seulement),
 *  opex indexé années 1..H, VR linéaire si la durée de vie dépasse H. */
function ajouterInfra(flux, plan, p) {
  const h = p.horizonAns;
  const taxes = 1 + p.tauxTaxesNonRecuperables;
  for (const site of plan.sitesInfra ?? []) {
    flux.investissement[0] += site.capexAvantTaxes * taxes;
    for (const s of site.subventions ?? []) {
      if (s.annee <= h) flux.subventions[s.annee] += s.montant;
    }
    for (let n = 1; n <= h; n++) {
      flux.opexInfra[n] +=
        site.capexAvantTaxes * p.infra.entretienAnnuelPctCapex * (1 + p.inflations.entretien) ** n;
    }
    if (p.infra.dureeVieAns > h) {
      flux.residuels[h] += (site.capexAvantTaxes * (p.infra.dureeVieAns - h)) / p.infra.dureeVieAns;
    }
  }
}

function finaliser(flux, p) {
  const h = p.horizonAns;
  let tco = 0;
  for (let n = 0; n <= h; n++) {
    flux.net[n] =
      flux.investissement[n] +
      flux.energie[n] +
      flux.entretien[n] +
      flux.evenements[n] +
      flux.opexInfra[n] -
      flux.subventions[n] -
      flux.residuels[n];
    tco += flux.net[n] / (1 + p.tauxActualisationNominal) ** n;
  }
  return tco;
}

function payback(diffs, actualise, p) {
  const h = p.horizonAns;
  let cumul = 0;
  let economieMax = -Infinity;
  for (let n = 0; n <= h; n++) {
    const d = actualise ? diffs[n] / (1 + p.tauxActualisationNominal) ** n : diffs[n];
    cumul += d;
    if (n >= 1) economieMax = Math.max(economieMax, d);
    if (cumul >= -1e-6) return { annees: n, raison: null };
  }
  return {
    annees: null,
    raison:
      economieMax <= 0
        ? 'les économies annuelles sont nulles ou négatives'
        : `le surcoût n'est pas résorbé à l'horizon H=${h}`,
  };
}

/** Point d'entrée : mêmes sorties principales que le moteur. */
export function contreCalculerPlan(plan) {
  const p = plan.parametres;
  const h = p.horizonAns;

  const fluxAlt = fluxVides(h);
  const fluxRef = fluxVides(h);
  let ttwAlt = 0, wtwAlt = 0, ttwRef = 0, wtwRef = 0;

  for (const v of plan.vehicules) {
    const ea = ajouterVehicule(fluxAlt, v, v.alternative, true, p);
    ttwAlt += ea.ttw; wtwAlt += ea.wtw;
    const er = ajouterVehicule(fluxRef, v, v.reference, false, p);
    ttwRef += er.ttw; wtwRef += er.wtw;
  }
  ajouterInfra(fluxAlt, plan, p);

  const tcoAlt = finaliser(fluxAlt, p);
  const tcoRef = finaliser(fluxRef, p);

  let kmActualises = 0;
  for (const v of plan.vehicules) {
    for (let n = (v.anneeAcquisition ?? 0) + 1; n <= h; n++) {
      kmActualises += v.kmParAn / (1 + p.tauxActualisationNominal) ** n;
    }
  }

  const diffs = fluxRef.net.map((r, n) => r - fluxAlt.net[n]);
  const co2EviteTtw = ttwRef - ttwAlt;
  const co2EviteWtw = wtwRef - wtwAlt;

  return {
    tcoActualiseAlt: tcoAlt,
    tcoActualiseRef: tcoRef,
    vanDifferentielle: tcoRef - tcoAlt,
    tcoParKmAlt: kmActualises > 0 ? tcoAlt / kmActualises : 0,
    paybackSimple: payback(diffs, false, p),
    paybackActualise: payback(diffs, true, p),
    co2EviteTtwTonnes: co2EviteTtw,
    co2EviteWtwTonnes: co2EviteWtw,
    // Convention (§6.1) : surcoût ACTUALISÉ ÷ tonnes physiques NON actualisées.
    coutParTonneWtw: co2EviteWtw > 1e-9 ? (tcoAlt - tcoRef) / co2EviteWtw : null,
  };
}
