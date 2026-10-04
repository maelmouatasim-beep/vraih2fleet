/**
 * Suggestion d'année de remplacement d'un véhicule — logique PURE (testée).
 * Aucune valeur inventée ici : la durée de vie vient des défauts de
 * catégorie du moteur TCO (statut « estimation », affichés comme tels).
 * Sans catégorie connue du moteur ou sans année de départ, pas de
 * suggestion (null) — l'utilisateur choisit lui-même.
 */
import { DEFAUTS_CATEGORIES } from "@/lib/tco";
import { categorieMoteur } from "@/lib/journey/categories";

export interface VehiculePourSuggestion {
  category: string;
  model_year: number | null;
  in_service_date: string | null; // AAAA-MM-JJ
}

/** Durée de vie par défaut de la catégorie (moteur TCO), ou null si inconnue. */
export function dureeVieCategorie(category: string): number | null {
  const defauts = (DEFAUTS_CATEGORIES as Record<string, { dureeVieAns: number }>)[categorieMoteur(category) ?? category];
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

/** Rattrapage proposé par défaut (années) — choix de l'utilisateur, modifiable dans l'étape Flotte. */
export const RATTRAPAGE_ANS_DEFAUT = 3;

export interface VehiculeARemplacer {
  id: string;
  /** Année de remplacement « naturelle » (fin de vie), éventuellement passée. */
  anneeFinVie: number | null;
}

/**
 * Rattrapage LISSÉ des remplacements en retard (audit acheteur, point 7) :
 * les véhicules déjà en fin de vie (fin de vie ≤ année courante) ne sont
 * plus tous placés dans l'année en cours — budget déjà voté, achat
 * impossible en quelques semaines — mais répartis à parts égales sur les
 * `nbAnnees` années suivantes, les plus anciens d'abord. Les autres gardent
 * leur année de fin de vie. PUR, déterministe.
 */
export function lisserRattrapage(
  vehicules: VehiculeARemplacer[],
  anneeCourante: number,
  nbAnnees: number,
): Map<string, number | null> {
  const n = Math.max(1, Math.floor(nbAnnees));
  const resultat = new Map<string, number | null>();
  const enRetard: VehiculeARemplacer[] = [];
  for (const v of vehicules) {
    if (v.anneeFinVie == null) resultat.set(v.id, null);
    else if (v.anneeFinVie <= anneeCourante) enRetard.push(v);
    else resultat.set(v.id, v.anneeFinVie);
  }
  enRetard.sort((a, b) => (a.anneeFinVie ?? 0) - (b.anneeFinVie ?? 0) || a.id.localeCompare(b.id));
  enRetard.forEach((v, i) => resultat.set(v.id, anneeCourante + 1 + Math.floor((i * n) / enRetard.length)));
  return resultat;
}

/** Année de fin de vie (mise en service ou année modèle + durée de vie), sans plancher. */
export function anneeFinVie(vehicule: VehiculePourSuggestion): number | null {
  const duree = dureeVieCategorie(vehicule.category);
  if (duree == null) return null;
  const debut = vehicule.in_service_date ? Number.parseInt(vehicule.in_service_date.slice(0, 4), 10) : vehicule.model_year;
  if (debut == null || !Number.isFinite(debut)) return null;
  return debut + duree;
}
