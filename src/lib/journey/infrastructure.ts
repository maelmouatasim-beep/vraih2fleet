/**
 * Plan d'infrastructure PAR GARAGE — SOURCE UNIQUE (logique pure).
 *
 * Utilisé par Stratégies (sites du moteur), Plan (carte par garage),
 * Financement, Rapports et Excel : le même projet affiche donc le même
 * total d'infrastructure partout, au dollar près.
 *
 * Modèle (§3.5) : une borne par véhicule électrique (BEV), du type
 * correspondant à sa catégorie ; une station H2 par garage qui accueille
 * des FCEV. Le capex d'un garage est engagé l'année d'arrivée de ses
 * premiers véhicules.
 *
 * Raccordement (1.2) : il dépend de la puissance DEMANDÉE (somme des
 * puissances maximales des bornes, sans gestion de charge) comparée à la
 * puissance DISPONIBLE du garage. Aucune mise à niveau si les bornes
 * tiennent dans la capacité existante ; sinon un palier de coût selon les
 * kW supplémentaires (hypothèses du registre, statut « estimation »).
 * Un DEVIS client est toujours prioritaire sur l'estimation.
 */
import { HYPOTHESES } from "@/lib/tco";

export type TypeBorne = "niveau2" | "rapide50" | "rapide150";

/** Puissances tirées des descriptions du registre (mêmes hypothèses que le CAPEX). */
export const BORNES: Record<
  TypeBorne,
  { hypotheseId: string; capex: number; puissanceMinKw: number; puissanceMaxKw: number }
> = {
  niveau2: {
    hypotheseId: "borne_niveau2_installee",
    capex: HYPOTHESES.borne_niveau2_installee.valeur,
    puissanceMinKw: 7,
    puissanceMaxKw: 19,
  },
  rapide50: {
    hypotheseId: "borne_rapide_50kw_installee",
    capex: HYPOTHESES.borne_rapide_50kw_installee.valeur,
    puissanceMinKw: 50,
    puissanceMaxKw: 50,
  },
  rapide150: {
    hypotheseId: "borne_rapide_150kw_installee",
    capex: HYPOTHESES.borne_rapide_150kw_installee.valeur,
    puissanceMinKw: 150,
    puissanceMaxKw: 150,
  },
};

/** Type de borne par catégorie de véhicule. */
export const TYPE_BORNE_PAR_CATEGORIE: Record<string, TypeBorne> = {
  vehicule_leger: "niveau2",
  camionnette: "niveau2",
  camion_moyen: "rapide50",
  camion_lourd: "rapide150",
  autobus_urbain_12m: "rapide150",
};

/** Véhicule zéro émission retenu par une stratégie, avec son garage. */
export interface VehiculeInfra {
  id: string;
  unit_number?: string;
  category: string;
  /** Garage (dépôt) du véhicule ; null = non renseigné (regroupés, signalés). */
  depot: string | null;
  technologie: "BEV" | "FCEV";
  /** Année du PLAN (0 = année de référence) d'arrivée du véhicule. */
  anneeAcquisition: number;
}

/** aucun = pas de borne ; capacite_existante = les bornes tiennent dans
 *  la puissance disponible ; estimation = palier du registre ;
 *  devis_projet = devis client saisi dans le projet (prioritaire). */
export type SourceRaccordement = "aucun" | "capacite_existante" | "estimation" | "devis_projet" | "devis_garage";

export interface DetailRaccordement {
  cout: number;
  source: SourceRaccordement;
  /** Puissance demandée par les bornes du garage (kW, valeurs maximales). */
  kwDemandes: number;
  /** Puissance disponible du garage (kW). */
  kwDisponibles: number;
  /** garage = valeur renseignée ; presumee = hypothèse du registre. */
  kwDisponiblesSource: "garage" | "presumee";
  /** max(0, demandés − disponibles). */
  kwSupplementaires: number;
  /** Palier de mise à niveau retenu (0 = aucun travaux). */
  palier: 0 | 1 | 2 | 3;
}

/** Caractéristiques d'un garage connues de l'organisation (bloc 2). */
export interface CaracteristiquesGarage {
  puissanceDisponibleKw?: number | null;
  devisRaccordement?: number | null;
}

export interface PhaseGarage {
  /** Année CALENDAIRE. */
  annee: number;
  bornes: Partial<Record<TypeBorne, number>>;
  puissanceAjouteeMinKw: number;
  puissanceAjouteeMaxKw: number;
  unites: string[];
}

export interface InfraGarage {
  /** Clé stable du garage (nom normalisé, ou « sans garage »). */
  cle: string;
  /** Nom affiché ; null = véhicules sans garage renseigné. */
  depot: string | null;
  vehiculesBev: string[];
  vehiculesFcev: string[];
  bornes: Partial<Record<TypeBorne, number>>;
  capexBornes: number;
  puissanceMinKw: number;
  puissanceMaxKw: number;
  raccordement: DetailRaccordement;
  capexStationH2: number;
  /** Années du PLAN de mise en service (null = rien de ce type). */
  anneeMiseEnServiceRecharge: number | null;
  anneeMiseEnServiceH2: number | null;
  phasage: PhaseGarage[];
  /** Catégories sans correspondance de borne (« autre ») — signalées. */
  categoriesInconnues: string[];
  /** Bornes + raccordement + station H2 du garage. */
  capexTotal: number;
}

export interface PlanInfrastructure {
  garages: InfraGarage[];
  capexBornes: number;
  raccordement: number;
  capexStationsH2: number;
  /** Total du projet — LE chiffre affiché partout. */
  totalCapex: number;
  /** Devis client de raccordement du projet (prioritaire), s'il y en a un. */
  devisRaccordementProjet: number | null;
}

export interface OptionsInfrastructure {
  anneeReference: number;
  devisRaccordementProjet?: number | null;
  /** Garages de l'organisation, par clé (cleGarage). */
  garages?: Map<string, CaracteristiquesGarage>;
}

/** Paliers de mise à niveau (registre des hypothèses). */
export const PALIERS_RACCORDEMENT = [
  { palier: 1 as const, kwMax: HYPOTHESES.raccordement_seuil_palier1_kw.valeur, hypotheseId: "raccordement_palier1", cout: HYPOTHESES.raccordement_palier1.valeur },
  { palier: 2 as const, kwMax: HYPOTHESES.raccordement_seuil_palier2_kw.valeur, hypotheseId: "raccordement_palier2", cout: HYPOTHESES.raccordement_palier2.valeur },
  { palier: 3 as const, kwMax: Infinity, hypotheseId: "raccordement_palier3", cout: HYPOTHESES.raccordement_palier3.valeur },
];

const SANS_GARAGE = "__sans_garage__";

/** Clé de regroupement d'un garage saisi en texte libre (casse et espaces ignorés). */
export function cleGarage(depot: string | null | undefined): string {
  const nom = depot?.trim().replace(/\s+/g, " ");
  return nom ? nom.toLocaleLowerCase("fr") : SANS_GARAGE;
}

/** Raccordement d'un garage : puissance demandée vs disponible → palier. */
export function calculerRaccordement(
  kwDemandes: number,
  garage: CaracteristiquesGarage | undefined,
): DetailRaccordement {
  const renseignee = garage?.puissanceDisponibleKw;
  const kwDisponibles =
    renseignee != null && renseignee >= 0 ? renseignee : HYPOTHESES.puissance_disponible_garage_presumee.valeur;
  const base = {
    kwDemandes,
    kwDisponibles,
    kwDisponiblesSource: renseignee != null && renseignee >= 0 ? ("garage" as const) : ("presumee" as const),
    kwSupplementaires: Math.max(0, kwDemandes - kwDisponibles),
  };
  if (kwDemandes <= 0) return { ...base, cout: 0, source: "aucun", palier: 0 };
  if (garage?.devisRaccordement != null) {
    const palier = base.kwSupplementaires <= 0 ? 0 : PALIERS_RACCORDEMENT.find((p) => base.kwSupplementaires <= p.kwMax)!.palier;
    return { ...base, cout: garage.devisRaccordement, source: "devis_garage", palier };
  }
  if (base.kwSupplementaires <= 0) return { ...base, cout: 0, source: "capacite_existante", palier: 0 };
  const p = PALIERS_RACCORDEMENT.find((x) => base.kwSupplementaires <= x.kwMax)!;
  return { ...base, cout: p.cout, source: "estimation", palier: p.palier };
}

export function planifierInfrastructure(
  vehicules: VehiculeInfra[],
  options: OptionsInfrastructure,
): PlanInfrastructure {
  const parGarage = new Map<string, { depot: string | null; liste: VehiculeInfra[] }>();
  for (const v of vehicules) {
    const cle = cleGarage(v.depot);
    const entree = parGarage.get(cle) ?? {
      depot: v.depot?.trim().replace(/\s+/g, " ") || null,
      liste: [],
    };
    entree.liste.push(v);
    parGarage.set(cle, entree);
  }

  const garages: InfraGarage[] = [];
  for (const [cle, { depot, liste }] of parGarage) {
    const bev = liste.filter((v) => v.technologie === "BEV");
    const fcev = liste.filter((v) => v.technologie === "FCEV");
    const bornes: Partial<Record<TypeBorne, number>> = {};
    const categoriesInconnues = new Set<string>();
    const parAnnee = new Map<number, PhaseGarage>();
    let capexBornes = 0;
    let puissanceMinKw = 0;
    let puissanceMaxKw = 0;

    for (const v of bev) {
      const type = TYPE_BORNE_PAR_CATEGORIE[v.category];
      if (!type) {
        categoriesInconnues.add(v.category);
        continue;
      }
      const borne = BORNES[type];
      bornes[type] = (bornes[type] ?? 0) + 1;
      capexBornes += borne.capex;
      puissanceMinKw += borne.puissanceMinKw;
      puissanceMaxKw += borne.puissanceMaxKw;

      const annee = options.anneeReference + v.anneeAcquisition;
      const phase = parAnnee.get(annee) ?? {
        annee,
        bornes: {},
        puissanceAjouteeMinKw: 0,
        puissanceAjouteeMaxKw: 0,
        unites: [],
      };
      phase.bornes[type] = (phase.bornes[type] ?? 0) + 1;
      phase.puissanceAjouteeMinKw += borne.puissanceMinKw;
      phase.puissanceAjouteeMaxKw += borne.puissanceMaxKw;
      phase.unites.push(v.unit_number ?? v.id);
      parAnnee.set(annee, phase);
    }

    const premiere = (l: VehiculeInfra[]) =>
      l.length > 0 ? Math.min(...l.map((v) => v.anneeAcquisition)) : null;
    const raccordement = calculerRaccordement(puissanceMaxKw, options.garages?.get(cle));
    const capexStationH2 = fcev.length > 0 ? HYPOTHESES.station_h2_depot.valeur : 0;

    garages.push({
      cle,
      depot,
      vehiculesBev: bev.map((v) => v.id),
      vehiculesFcev: fcev.map((v) => v.id),
      bornes,
      capexBornes,
      puissanceMinKw,
      puissanceMaxKw,
      raccordement,
      capexStationH2,
      anneeMiseEnServiceRecharge: premiere(bev),
      anneeMiseEnServiceH2: premiere(fcev),
      phasage: [...parAnnee.values()].sort((a, b) => a.annee - b.annee),
      categoriesInconnues: [...categoriesInconnues],
      capexTotal: 0,
    });
  }

  // Devis client du PROJET : il remplace les estimations des garages sans
  // devis propre, réparti au prorata des estimations (sinon des kW
  // demandés) — le total de ces garages est exactement le devis.
  const devis = options.devisRaccordementProjet ?? null;
  const garagesVises = garages.filter((g) => g.vehiculesBev.length > 0 && g.raccordement.source !== "devis_garage");
  if (devis != null && garagesVises.length > 0) {
    const base = garagesVises.reduce((s, g) => s + g.raccordement.cout, 0);
    const kw = garagesVises.reduce((s, g) => s + g.raccordement.kwDemandes, 0);
    for (const g of garagesVises) {
      const part =
        base > 0 ? g.raccordement.cout / base : kw > 0 ? g.raccordement.kwDemandes / kw : 1 / garagesVises.length;
      g.raccordement = { ...g.raccordement, cout: devis * part, source: "devis_projet" };
    }
  }

  for (const g of garages) g.capexTotal = g.capexBornes + g.raccordement.cout + g.capexStationH2;
  garages.sort((a, b) => (a.depot ?? "￿").localeCompare(b.depot ?? "￿", "fr"));

  const capexBornes = garages.reduce((s, g) => s + g.capexBornes, 0);
  const raccordement = garages.reduce((s, g) => s + g.raccordement.cout, 0);
  const capexStationsH2 = garages.reduce((s, g) => s + g.capexStationH2, 0);
  return {
    garages,
    capexBornes,
    raccordement,
    capexStationsH2,
    totalCapex: capexBornes + raccordement + capexStationsH2,
    devisRaccordementProjet: devis,
  };
}

/** Sites du moteur TCO dérivés du plan d'infrastructure : un site de
 *  recharge et/ou un site H2 par garage (sites homogènes : répartition au
 *  prorata de l'énergie). Σ capex des sites = totalCapex, par construction. */
export function sitesInfraMoteur(plan: PlanInfrastructure): {
  id: string;
  capexAvantTaxes: number;
  vehiculeIds: string[];
  anneeMiseEnService: number;
}[] {
  const sites = [];
  for (const g of plan.garages) {
    if (g.vehiculesBev.length > 0) {
      sites.push({
        id: `recharge:${g.cle}`,
        capexAvantTaxes: g.capexBornes + g.raccordement.cout,
        vehiculeIds: g.vehiculesBev,
        anneeMiseEnService: g.anneeMiseEnServiceRecharge ?? 0,
      });
    }
    if (g.vehiculesFcev.length > 0) {
      sites.push({
        id: `h2:${g.cle}`,
        capexAvantTaxes: g.capexStationH2,
        vehiculeIds: g.vehiculesFcev,
        anneeMiseEnService: g.anneeMiseEnServiceH2 ?? 0,
      });
    }
  }
  return sites;
}
