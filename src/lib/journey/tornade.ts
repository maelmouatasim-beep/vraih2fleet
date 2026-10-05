/**
 * Tornade du stress test, lisible par un trésorier (point 13 de l'audit) —
 * logique PURE partagée par l'écran Stratégies et le rapport PDF :
 * - un libellé complet et clair par hypothèse (aucune troncature) ;
 * - la valeur basse et la valeur haute testées, dans leur unité ;
 * - l'économie (VAN) recalculée par le moteur à chacune des deux bornes ;
 * - pourquoi le statu quo change d'un scénario à l'autre.
 */
import type { BarreTornade, ResultatSensibilite } from "@/lib/tco";
import { formateurCad, formateurNombre } from "@/lib/format";
import { lienCategorie, lienHypotheses, lienProgrammes, HYPOTHESES_PAR_POSTE } from "@/lib/library/liens";

type Langue = "fr" | "en";

export const LIBELLES_PARAMETRES: Record<Langue, Record<string, string>> = {
  fr: {
    prix_diesel: "Prix du diesel",
    prix_electricite: "Coût de l'électricité au garage",
    prix_achat_alternative: "Prix d'achat des véhicules électriques et à hydrogène",
    capex_infrastructure: "Coût des bornes, du raccordement et de la station H2",
    subventions: "Part des subventions réellement obtenue",
    inflation_diesel: "Hausse annuelle du prix du diesel",
    entretien_alternative: "Entretien des véhicules électriques et à hydrogène",
    consommation_alternative: "Consommation des véhicules électriques et à hydrogène",
    valeur_residuelle_alternative: "Perte de valeur des véhicules électriques et à hydrogène",
    majoration_hivernale: "Surconsommation d'hiver (moyenne sur l'année)",
    taux_actualisation: "Taux d'actualisation",
    prix_h2: "Prix de l'hydrogène livré",
  },
  en: {
    prix_diesel: "Diesel price",
    prix_electricite: "Electricity cost at the garage",
    prix_achat_alternative: "Purchase price of electric and hydrogen vehicles",
    capex_infrastructure: "Cost of chargers, grid connection and H2 station",
    subventions: "Share of subsidies actually obtained",
    inflation_diesel: "Annual increase in the diesel price",
    entretien_alternative: "Maintenance of electric and hydrogen vehicles",
    consommation_alternative: "Consumption of electric and hydrogen vehicles",
    valeur_residuelle_alternative: "Depreciation of electric and hydrogen vehicles",
    majoration_hivernale: "Winter overconsumption (annual average)",
    taux_actualisation: "Discount rate",
    prix_h2: "Delivered hydrogen price",
  },
};

type Format = "dollarsL" | "dollarsKwh" | "dollarsKg" | "ecart" | "part" | "taux";

const FORMATS: Record<string, Format> = {
  prix_diesel: "dollarsL",
  prix_electricite: "dollarsKwh",
  prix_h2: "dollarsKg",
  prix_achat_alternative: "ecart",
  capex_infrastructure: "ecart",
  entretien_alternative: "ecart",
  consommation_alternative: "ecart",
  valeur_residuelle_alternative: "ecart",
  subventions: "part",
  inflation_diesel: "taux",
  taux_actualisation: "taux",
  majoration_hivernale: "taux",
};

/** Valeur d'un paramètre dans son unité (« 1,82 $/L », « −15 % », « 70 % »…). */
export function formaterValeurParametre(id: string, v: number | undefined, langue: Langue): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const n = (d: number) => formateurNombre(langue, d);
  const sep = " ";
  switch (FORMATS[id]) {
    case "dollarsL":
      return langue === "en" ? `$${n(2).format(v)}/L` : `${n(2).format(v)}${sep}$/L`;
    case "dollarsKwh":
      return langue === "en" ? `$${n(3).format(v)}/kWh` : `${n(3).format(v)}${sep}$/kWh`;
    case "dollarsKg":
      return langue === "en" ? `$${n(2).format(v)}/kg` : `${n(2).format(v)}${sep}$/kg`;
    case "ecart": {
      const pct = Math.round((v - 1) * 100);
      if (pct === 0) return langue === "en" ? "reference" : "référence";
      return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}${sep}%`;
    }
    case "part":
      return `${n(0).format(v * 100)}${sep}%`;
    case "taux":
      return `${n(1).format(v * 100)}${sep}%`;
    default:
      return n(2).format(v);
  }
}

/** Où mène chaque hypothèse de la tornade dans la Bibliothèque. */
export function lienParametre(id: string): string {
  switch (id) {
    case "prix_diesel":
      return lienHypotheses(["prix_diesel", "prix_essence"]);
    case "prix_electricite":
      return lienHypotheses(["cout_effectif_elec_depot", "hq_tarif_m_energie", "hq_tarif_m_puissance", "hq_tarif_g_energie"]);
    case "prix_achat_alternative":
      return lienCategorie(null, "prix");
    case "capex_infrastructure":
      return lienHypotheses(HYPOTHESES_PAR_POSTE.infrastructure);
    case "subventions":
      return lienProgrammes();
    case "inflation_diesel":
      return lienHypotheses(["inflation_diesel"]);
    case "entretien_alternative":
      return lienCategorie(null, "entretien");
    case "consommation_alternative":
      return lienCategorie(null, "consommation");
    case "valeur_residuelle_alternative":
      return lienHypotheses(["depreciation_bev", "depreciation_fcev", "plancher_residuel"]);
    case "majoration_hivernale":
      return lienHypotheses(["majoration_hivernale_bev", "part_km_hiver"]);
    case "taux_actualisation":
      return lienHypotheses(["taux_actualisation_nominal"]);
    case "prix_h2":
      return lienHypotheses(["prix_h2_livre"]);
    default:
      return lienHypotheses([]);
  }
}

export interface LigneTornade {
  id: string;
  libelle: string;
  basse: { valeur: string; van: number };
  haute: { valeur: string; van: number };
  centrale: string;
  /** Écart d'économie entre les deux bornes (≥ 0). */
  amplitude: number;
  lien: string;
}

export function lignesTornade(tornade: BarreTornade[], langue: Langue): LigneTornade[] {
  return tornade.map((b) => ({
    id: b.id,
    libelle: LIBELLES_PARAMETRES[langue][b.id] ?? b.libelle,
    basse: { valeur: formaterValeurParametre(b.id, b.basse, langue), van: b.vanBasse },
    haute: { valeur: formaterValeurParametre(b.id, b.haute, langue), van: b.vanHaute },
    centrale: formaterValeurParametre(b.id, b.centrale, langue),
    amplitude: b.amplitude,
    lien: lienParametre(b.id),
  }));
}

/** Échelle commune des barres : englobe toutes les bornes, zéro et la valeur centrale. */
export function echelleTornade(tornade: BarreTornade[], vanCentrale: number): { min: number; max: number } {
  const valeurs = [0, vanCentrale, ...tornade.flatMap((b) => [b.vanBasse, b.vanHaute])];
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  return max > min ? { min, max } : { min: min - 1, max: max + 1 };
}

/** « Économie de 120 000 $ » ou « Surcoût de 5 743 218 $ » — jamais une « économie » négative. */
export function libelleEcart(van: number, langue: Langue): string {
  const cad = formateurCad(langue);
  if (langue === "en") return van >= 0 ? `Savings of ${cad.format(van)}` : `Extra cost of ${cad.format(-van)}`;
  return van >= 0 ? `Économie de ${cad.format(van)}` : `Surcoût de ${cad.format(-van)}`;
}

type CleScenario = keyof ResultatSensibilite["scenarios"];

/**
 * Pourquoi le coût du statu quo change entre scénarios : le prix du diesel
 * et sa hausse annuelle (ce que coûte GARDER des véhicules thermiques) font
 * partie des hypothèses testées. La flotte et le calendrier ne changent pas.
 */
export function explicationStatuQuo(analyse: ResultatSensibilite, cle: CleScenario, langue: Langue): string {
  const diesel = analyse.tornade.find((b) => b.id === "prix_diesel");
  const inflation = analyse.tornade.find((b) => b.id === "inflation_diesel");
  const valeur = (b: BarreTornade | undefined) => {
    if (!b) return undefined;
    if (cle === "central") return b.centrale;
    const defavorable = b.sens === "hausse_favorable" ? b.basse : b.haute;
    const favorable = b.sens === "hausse_favorable" ? b.haute : b.basse;
    return cle === "prudent" ? defavorable : favorable;
  };
  const d = formaterValeurParametre("prix_diesel", valeur(diesel), langue);
  const i = formaterValeurParametre("inflation_diesel", valeur(inflation), langue);
  if (!diesel || !inflation) {
    return langue === "en"
      ? "The status quo is recomputed with the same assumptions as the scenario; the fleet and schedule do not change."
      : "Le statu quo est recalculé avec les mêmes hypothèses que le scénario ; la flotte et le calendrier ne changent pas.";
  }
  if (langue === "en") {
    if (cle === "central") return `Status quo at the registry's central values: diesel at ${d}, rising ${i} a year.`;
    return cle === "prudent"
      ? `Status quo cheaper than in the central case: diesel at ${d}, rising only ${i} a year — keeping combustion vehicles costs less, which works against the plan.`
      : `Status quo more expensive than in the central case: diesel at ${d}, rising ${i} a year — keeping combustion vehicles costs more, which favours the plan.`;
  }
  if (cle === "central") return `Statu quo aux valeurs centrales du registre : diesel à ${d}, en hausse de ${i} par an.`;
  return cle === "prudent"
    ? `Statu quo moins cher qu'au central : diesel à ${d}, en hausse de seulement ${i} par an — garder des véhicules thermiques coûte moins, ce qui joue contre le plan.`
    : `Statu quo plus cher qu'au central : diesel à ${d}, en hausse de ${i} par an — garder des véhicules thermiques coûte plus, ce qui favorise le plan.`;
}
