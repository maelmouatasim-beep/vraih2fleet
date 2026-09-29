/**
 * C6 — Dimensionnement MINIMAL de la recharge PAR DÉPÔT (logique pure).
 * Modèle assumé (le même que les stratégies, §3.5) : une borne par
 * véhicule zéro émission, du type correspondant à sa catégorie, mise en
 * service l'année de remplacement du véhicule. Les coûts viennent du
 * registre des hypothèses (PIVEZ/RNCan, statut « estimation ») et un
 * DEVIS DE RACCORDEMENT saisi dans le projet est prioritaire sur
 * l'estimation. Les puissances par type de borne sont celles des
 * hypothèses du registre (niveau 2 : 7-19 kW ; rapide ~50 kW ; ~150 kW),
 * affichées en fourchette — jamais un chiffre inventé.
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

/** Type de borne par catégorie (même correspondance que les stratégies). */
export const TYPE_BORNE_PAR_CATEGORIE: Record<string, TypeBorne> = {
  vehicule_leger: "niveau2",
  camionnette: "niveau2",
  camion_moyen: "rapide50",
  camion_lourd: "rapide150",
  autobus_urbain_12m: "rapide150",
};

export interface VehiculeDepot {
  id: string;
  unit_number: string;
  category: string;
  depot: string | null;
  replacement_year: number | null;
  target_technology: string | null; // 'diesel' | 'bev' | 'fcev' | null
}

export interface PhaseDepot {
  annee: number;
  bornes: Partial<Record<TypeBorne, number>>;
  puissanceAjouteeMinKw: number;
  puissanceAjouteeMaxKw: number;
  unites: string[];
}

export interface DepotDimensionne {
  /** null = véhicules sans dépôt renseigné (regroupés, signalés). */
  depot: string | null;
  nbBev: number;
  nbFcev: number;
  bornes: Partial<Record<TypeBorne, number>>;
  capexBornes: number;
  raccordementEstime: number;
  capexStationH2: number;
  puissanceMinKw: number;
  puissanceMaxKw: number;
  anneeMiseEnService: number;
  phasage: PhaseDepot[];
  /** Catégories sans correspondance de borne (« autre ») — signalées. */
  categoriesInconnues: string[];
}

export interface DimensionnementDepots {
  depots: DepotDimensionne[];
  /** Devis client saisi dans le projet : PRIORITAIRE sur les estimations
   *  de raccordement (il les remplace pour l'ensemble du projet). */
  devisRaccordement: number | null;
  totalCapex: number;
}

export function dimensionnerDepots(
  vehicules: VehiculeDepot[],
  options: { anneeReference: number; devisRaccordement?: number | null },
): DimensionnementDepots {
  const parDepot = new Map<string | null, VehiculeDepot[]>();
  for (const v of vehicules) {
    if (v.target_technology !== "bev" && v.target_technology !== "fcev") continue;
    const cle = v.depot?.trim() || null;
    const liste = parDepot.get(cle) ?? [];
    liste.push(v);
    parDepot.set(cle, liste);
  }

  const depots: DepotDimensionne[] = [];
  for (const [depot, liste] of parDepot) {
    const bev = liste.filter((v) => v.target_technology === "bev");
    const fcev = liste.filter((v) => v.target_technology === "fcev");
    const bornes: Partial<Record<TypeBorne, number>> = {};
    const categoriesInconnues = new Set<string>();
    const parAnnee = new Map<number, PhaseDepot>();
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

      const annee = v.replacement_year ?? options.anneeReference;
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
      phase.unites.push(v.unit_number);
      parAnnee.set(annee, phase);
    }

    const phasage = [...parAnnee.values()].sort((a, b) => a.annee - b.annee);
    const anneesFcev = fcev.map((v) => v.replacement_year ?? options.anneeReference);
    const anneeMiseEnService = Math.min(
      ...(phasage.length > 0 ? [phasage[0].annee] : []),
      ...(anneesFcev.length > 0 ? [Math.min(...anneesFcev)] : []),
      ...(phasage.length === 0 && anneesFcev.length === 0 ? [options.anneeReference] : []),
    );

    depots.push({
      depot,
      nbBev: bev.length,
      nbFcev: fcev.length,
      bornes,
      capexBornes,
      raccordementEstime: bev.length > 0 ? HYPOTHESES.raccordement_depot.valeur : 0,
      capexStationH2: fcev.length > 0 ? HYPOTHESES.station_h2_depot.valeur : 0,
      puissanceMinKw,
      puissanceMaxKw,
      anneeMiseEnService,
      phasage,
      categoriesInconnues: [...categoriesInconnues],
    });
  }

  depots.sort((a, b) => (a.depot ?? "￿").localeCompare(b.depot ?? "￿", "fr"));

  const devis = options.devisRaccordement ?? null;
  const raccordements = depots.reduce((s, d) => s + d.raccordementEstime, 0);
  const totalCapex =
    depots.reduce((s, d) => s + d.capexBornes + d.capexStationH2, 0) +
    (devis != null ? devis : raccordements);

  return { depots, devisRaccordement: devis, totalCapex };
}
