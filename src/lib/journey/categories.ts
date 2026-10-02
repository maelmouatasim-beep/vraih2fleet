/**
 * Catégories municipales (test terrain, bloc 2.3) : déneigeuse,
 * souffleuse, camion à benne, véhicule spécialisé/outil, véhicule
 * d'urgence. Le moteur TCO ne connaît que ses catégories (registre
 * src/lib/tco) : chaque catégorie municipale EMPRUNTE les défauts d'une
 * catégorie du moteur — signalés « estimation » à l'écran — et celles
 * pour lesquelles aucun véhicule électrique crédible n'est disponible
 * aujourd'hui sont « à reporter » : jamais électrifiées par une
 * stratégie automatique, pas de verdict chiffré en Faisabilité.
 */
import { DEFAUTS_CATEGORIES } from "@/lib/tco";

type CategorieMoteur = keyof typeof DEFAUTS_CATEGORIES;

export const CATEGORIES_MUNICIPALES = [
  "deneigeuse",
  "souffleuse",
  "camion_benne",
  "vehicule_specialise",
  "vehicule_urgence",
] as const;
export type CategorieMunicipale = (typeof CATEGORIES_MUNICIPALES)[number];

/** Catégorie du moteur dont les défauts sont empruntés (estimation). */
export const CATEGORIE_MOTEUR: Record<CategorieMunicipale, CategorieMoteur> = {
  deneigeuse: "camion_lourd",
  souffleuse: "camion_lourd",
  camion_benne: "camion_lourd",
  vehicule_specialise: "camion_moyen",
  vehicule_urgence: "camionnette",
};

/** Catégories à REPORTER (pas de VE crédible aujourd'hui) et pourquoi. */
export const A_REPORTER: Partial<Record<CategorieMunicipale, "pas_de_ve_credible" | "disponibilite_critique" | "cas_par_cas">> = {
  deneigeuse: "pas_de_ve_credible",
  souffleuse: "pas_de_ve_credible",
  vehicule_specialise: "cas_par_cas",
  vehicule_urgence: "disponibilite_critique",
};

export function estCategorieMunicipale(c: string): c is CategorieMunicipale {
  return (CATEGORIES_MUNICIPALES as readonly string[]).includes(c);
}

/** Catégorie du moteur à utiliser pour une catégorie de flotte (null = inconnue, ex. « autre »). */
export function categorieMoteur(c: string): CategorieMoteur | null {
  if (estCategorieMunicipale(c)) return CATEGORIE_MOTEUR[c];
  return c in DEFAUTS_CATEGORIES ? (c as CategorieMoteur) : null;
}

export function raisonAReporter(c: string) {
  return estCategorieMunicipale(c) ? A_REPORTER[c] ?? null : null;
}
