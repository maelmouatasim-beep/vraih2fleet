/**
 * Classe de poids réglementaire PNBV (poids nominal brut du véhicule),
 * test terrain bloc 2.2. Seuils des classes (kg, bornes supérieures) :
 * 1 ≤ 2 722 ; 2a ≤ 3 855 ; 2b ≤ 4 535 ; 3 ≤ 6 350 ; 4 ≤ 7 257 ; 5 ≤ 8 845 ;
 * 6 ≤ 11 793 ; 7 ≤ 14 969 ; 8 au-delà — les classes 2b, 3, 4, 5-7 et 8
 * reprennent les bornes des modalités Écocamionnage (tableau 2,
 * subsidy-programs.ts) ; 1/2a et 5/6/7 suivent la classification
 * nord-américaine usuelle (6 000, 8 500, 19 500, 26 000 lb).
 *
 * La PROPOSITION (catégorie, modèle) n'est jamais enregistrée seule :
 * l'utilisateur la confirme sur la fiche du véhicule.
 */
import type { ClassePoids } from "@/lib/tco";

export const CLASSES_PNBV = ["1", "2a", "2b", "3", "4", "5", "6", "7", "8"] as const;
export type ClassePnbv = (typeof CLASSES_PNBV)[number];

const SEUILS_KG: [number, ClassePnbv][] = [
  [2722, "1"],
  [3855, "2a"],
  [4535, "2b"],
  [6350, "3"],
  [7257, "4"],
  [8845, "5"],
  [11793, "6"],
  [14969, "7"],
];

export function classeDepuisKg(kg: number): ClassePnbv {
  for (const [max, c] of SEUILS_KG) if (kg <= max) return c;
  return "8";
}

/**
 * Lit une classe saisie : « 2b », « classe 3 », « Class 8 », « 7 », ou un
 * PNBV en kg (« 4 200 », « 4200 kg ») ou en livres (« 9 500 lb »).
 * null si illisible (l'import le signale en erreur).
 */
export function lireClassePnbv(brut: unknown): ClassePnbv | null {
  if (brut == null) return null;
  const s = String(brut).trim().toLowerCase().replace(/^(classe|class|cl\.?)\s*/, "");
  if ((CLASSES_PNBV as readonly string[]).includes(s)) return s as ClassePnbv;
  const m = s.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".").match(/^(\d+(?:\.\d+)?)(kg|lb|lbs)?$/);
  if (!m) return null;
  const v = Number(m[1]);
  if (m[2]?.startsWith("lb")) return classeDepuisKg(v * 0.45359237);
  if (v >= 1000) return classeDepuisKg(v);
  return null;
}

/** Classe utilisable par le résolveur de subventions (barèmes par classe). */
export function classePourSubventions(c: string | null | undefined): ClassePoids | undefined {
  return c && (CLASSES_PNBV as readonly string[]).includes(c) ? (c as ClassePoids) : undefined;
}

export interface PropositionClasse {
  classe: ClassePnbv;
  /** Ce qui fonde la proposition (affiché à côté, à confirmer). */
  motif: "modele" | "categorie";
}

/**
 * Propose une classe à CONFIRMER : d'après le modèle quand il est
 * explicite (série 150/1500 = 2a, 250/2500 = 2b, 350/3500 = 3,
 * 450/4500 = 4, 550/5500 = 5 des pickups pleine grandeur), sinon
 * d'après la catégorie quand elle ne laisse pas de doute. null sinon.
 */
export function proposerClasse(v: { category?: string | null; model?: string | null }): PropositionClasse | null {
  const modele = (v.model ?? "").toLowerCase();
  const serie = modele.match(/\b(?:f-?|silverado\s*|sierra\s*|ram\s*)?(150|250|350|450|550|1500|2500|3500|4500|5500)\b/);
  if (serie && /(f-?\d|silverado|sierra|ram|super duty)/.test(modele)) {
    const n = Number(serie[1]);
    const cle = n >= 1000 ? n / 10 : n;
    const parSerie: Record<number, ClassePnbv> = { 150: "2a", 250: "2b", 350: "3", 450: "4", 550: "5" };
    if (parSerie[cle]) return { classe: parSerie[cle], motif: "modele" };
  }
  switch (v.category) {
    case "vehicule_leger":
      return { classe: "1", motif: "categorie" };
    case "camion_lourd":
    case "autobus_urbain_12m":
    case "deneigeuse":
      return { classe: "8", motif: "categorie" };
    default:
      return null;
  }
}
