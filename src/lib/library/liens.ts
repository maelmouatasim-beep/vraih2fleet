/**
 * Traçabilité pour le trésorier : chaque chiffre affiché renvoie, en un
 * clic, aux hypothèses de la Bibliothèque qui l'alimentent (valeur,
 * plage, statut, source, date de lecture). Logique PURE et testée :
 * construction des liens profonds et lecture de la cible dans l'URL.
 *
 *   /dashboard/library?h=prix_diesel,hq_tarif_m_energie   hypothèses ciblées
 *   /dashboard/library?onglet=categories&cat=autobus_urbain_12m&col=prix
 *   /dashboard/library?onglet=programmes
 */
import { DEFAUTS_CATEGORIES, HYPOTHESES, type CategorieVehicule } from "@/lib/tco";
import type { PosteVan } from "@/lib/journey/synthese";
import type { TypeBorne } from "@/lib/journey/infrastructure";

export const CHEMIN_BIBLIOTHEQUE = "/dashboard/library";

export type OngletBibliotheque = "hypotheses" | "categories" | "programmes" | "historique" | "surcharges" | "veille";
export type ColonneCategorie = "prix" | "consommation" | "entretien";

const ONGLETS: OngletBibliotheque[] = ["hypotheses", "categories", "programmes", "historique", "surcharges", "veille"];
const COLONNES: ColonneCategorie[] = ["prix", "consommation", "entretien"];

export type IdHypothese = keyof typeof HYPOTHESES;

const estHypothese = (id: string): id is IdHypothese => Object.prototype.hasOwnProperty.call(HYPOTHESES, id);
const estCategorie = (c: string): c is CategorieVehicule => Object.prototype.hasOwnProperty.call(DEFAUTS_CATEGORIES, c);

/** Lien vers une ou plusieurs hypothèses (les identifiants inconnus sont ignorés). */
export function lienHypotheses(ids: readonly string[]): string {
  const valides = [...new Set(ids.filter(estHypothese))];
  return valides.length ? `${CHEMIN_BIBLIOTHEQUE}?h=${valides.join(",")}` : CHEMIN_BIBLIOTHEQUE;
}

/** Lien vers les défauts par catégorie (prix d'achat, consommation, entretien). */
export function lienCategorie(categorie?: string | null, colonne?: ColonneCategorie): string {
  const p = new URLSearchParams({ onglet: "categories" });
  if (categorie && estCategorie(categorie)) p.set("cat", categorie);
  if (colonne) p.set("col", colonne);
  return `${CHEMIN_BIBLIOTHEQUE}?${p.toString()}`;
}

export const lienProgrammes = (): string => `${CHEMIN_BIBLIOTHEQUE}?onglet=programmes`;

/**
 * Hypothèses derrière chaque poste de la VAN (moteur, §6.4). Le taux
 * d'actualisation s'applique à tous les postes.
 */
export const HYPOTHESES_PAR_POSTE: Record<Exclude<PosteVan, "achat" | "entretien" | "subventions">, IdHypothese[]> = {
  energie: [
    "prix_diesel",
    "prix_essence",
    "hq_tarif_m_energie",
    "hq_tarif_m_puissance",
    "hq_tarif_g_energie",
    "cout_effectif_elec_depot",
    "prix_h2_livre",
    "rendement_recharge",
    "majoration_hivernale_bev",
    "part_km_hiver",
    "inflation_diesel",
    "inflation_electricite",
    "inflation_h2",
    "taux_actualisation_nominal",
  ],
  assurance: ["inflation_generale", "taux_actualisation_nominal"],
  infrastructure: [
    "borne_niveau2_installee",
    "borne_rapide_50kw_installee",
    "borne_rapide_150kw_installee",
    "raccordement_depot",
    "puissance_disponible_garage_presumee",
    "raccordement_seuil_palier1_kw",
    "raccordement_seuil_palier2_kw",
    "raccordement_palier1",
    "raccordement_palier2",
    "raccordement_palier3",
    "station_h2_depot",
    "seuil_station_h2_depot_vehicules",
    "entretien_infra_ratio",
    "duree_vie_infra",
    "taux_actualisation_nominal",
  ],
  valeurResiduelle: ["depreciation_diesel", "depreciation_bev", "depreciation_fcev", "plancher_residuel", "taux_actualisation_nominal"],
};

/** Où mène chaque ligne de la décomposition de la VAN. */
export function lienPoste(poste: PosteVan): string {
  if (poste === "achat") return lienCategorie(null, "prix");
  if (poste === "entretien") return lienCategorie(null, "entretien");
  if (poste === "subventions") return lienProgrammes();
  return lienHypotheses(HYPOTHESES_PAR_POSTE[poste]);
}

export const HYPOTHESE_BORNE: Record<TypeBorne, IdHypothese> = {
  niveau2: "borne_niveau2_installee",
  rapide50: "borne_rapide_50kw_installee",
  rapide150: "borne_rapide_150kw_installee",
};

/** Hypothèses du coût de raccordement d'un garage (palier retenu, ou montant forfaitaire). */
export function hypothesesRaccordement(palier: number, puissancePresumee: boolean): IdHypothese[] {
  const ids: IdHypothese[] =
    palier >= 1 && palier <= 3
      ? [`raccordement_palier${palier}` as IdHypothese, "raccordement_seuil_palier1_kw", "raccordement_seuil_palier2_kw"]
      : ["raccordement_depot"];
  if (puissancePresumee) ids.push("puissance_disponible_garage_presumee");
  return ids;
}

export interface CibleBibliotheque {
  onglet: OngletBibliotheque;
  /** Hypothèses mises en avant (filtre + surlignage), dans l'ordre demandé. */
  ids: IdHypothese[];
  categorie: CategorieVehicule | null;
  colonne: ColonneCategorie | null;
}

/** Lit la cible dans la chaîne de requête ; toute valeur inconnue est ignorée. */
export function lireCibleBibliotheque(search: string): CibleBibliotheque {
  const p = new URLSearchParams(search);
  const ids = [...new Set((p.get("h") ?? "").split(",").map((s) => s.trim()).filter(estHypothese))];
  const cat = p.get("cat");
  const col = p.get("col") as ColonneCategorie | null;
  const ongletDemande = p.get("onglet") as OngletBibliotheque | null;
  const onglet: OngletBibliotheque =
    ongletDemande && ONGLETS.includes(ongletDemande) ? ongletDemande : cat || col ? "categories" : "hypotheses";
  return {
    onglet,
    ids,
    categorie: cat && estCategorie(cat) ? cat : null,
    colonne: col && COLONNES.includes(col) ? col : null,
  };
}

export interface SourceCategorie {
  texte: string;
  url: string | null;
  aValider: boolean;
}

/** Sources d'une catégorie (« Libellé (à_valider : https://…) ») découpées en texte + lien. */
export function sourcesCategorie(categorie: CategorieVehicule): SourceCategorie[] {
  return DEFAUTS_CATEGORIES[categorie].sources.map((s) => {
    const url = /https?:\/\/[^\s)]+/.exec(s)?.[0] ?? null;
    const aValider = /à_valider/.test(s);
    const texte = s
      .replace(/\s*\((?:à_valider)?\s*:?\s*https?:\/\/[^\s)]+\)\s*/g, " ")
      .replace(/\s*\(à_valider\)\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { texte, url, aValider };
  });
}
