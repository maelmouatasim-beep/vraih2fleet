/**
 * Constantes de la flotte — module PUR (aucun import du client Supabase)
 * pour que la validation d'import reste testable sans environnement.
 */
export const CATEGORIES_VEHICULE = [
  "vehicule_leger",
  "camionnette",
  "camion_moyen",
  "camion_lourd",
  "autobus_urbain_12m",
  // catégories municipales (bloc 2.3) — défauts empruntés au moteur, cf. src/lib/journey/categories.ts
  "deneigeuse",
  "souffleuse",
  "camion_benne",
  "vehicule_specialise",
  "vehicule_urgence",
  "autre",
] as const;

export const CARBURANTS = [
  "diesel",
  "essence",
  "hybride",
  "phev",
  "bev",
  "fcev",
  "gnc",
  "propane",
  "autre",
] as const;

export const SOURCES_CONSOMMATION = ["saisie", "import", "telematique", "estimation"] as const;
export const STATUTS_VEHICULE = ["actif", "inactif", "reforme", "vendu"] as const;
export const PROFILS_USAGE = ["urbain", "regional", "longue_distance", "mixte", "hors_route"] as const;
