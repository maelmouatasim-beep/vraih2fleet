/**
 * Suggestion d'année de remplacement d'un véhicule — logique PURE (testée).
 * Aucune valeur inventée ici : la durée de vie vient des défauts de
 * catégorie du moteur TCO (statut « estimation », affichés comme tels).
 * Sans catégorie connue du moteur ou sans année de départ, pas de
 * suggestion (null) — l'utilisateur choisit lui-même.
 */
import { DEFAUTS_CATEGORIES } from "@/lib/tco";

export interface VehiculePourSuggestion {
  category: string;
  model_year: number | null;
  in_service_date: string | null; // AAAA-MM-JJ
}

/** Durée de vie par défaut de la catégorie (moteur TCO), ou null si inconnue. */
export function dureeVieCategorie(category: string): number | null {
  const defauts = (DEFAUTS_CATEGORIES as Record<string, { dureeVieAns: number }>)[category];
  return defauts ? defauts.dureeVieAns : null;
}

/**
 * Année de remplacement suggérée : année de mise en service (à défaut,
 * année modèle) + durée de vie de la catégorie, jamais avant l'année
 * courante (un véhicule déjà en fin de vie → remplacement dès maintenant).
 */
export function anneeRemplacementSuggeree(
  vehicule: VehiculePourSuggestion,
  anneeCourante: number,
): number | null {
  const duree = dureeVieCategorie(vehicule.category);
  if (duree == null) return null;
  const debut = vehicule.in_service_date
    ? Number.parseInt(vehicule.in_service_date.slice(0, 4), 10)
    : vehicule.model_year;
  if (debut == null || !Number.isFinite(debut)) return null;
  return Math.max(anneeCourante, debut + duree);
}
