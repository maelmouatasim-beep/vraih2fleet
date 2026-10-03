/**
 * Barre des 7 étapes — règles PURES de présentation (testées) : mode de
 * mise en page selon la largeur RÉELLE disponible (la barre latérale du
 * tableau de bord en prend une partie, la largeur de l'écran ne suffit
 * donc pas à garantir l'absence de chevauchement), état visuel unique par
 * étape et couleur de chaque segment de la ligne de progression.
 */
import type { EtatEtape } from "./progress";

export type ModeBarre = "complet" | "compact" | "cercles";

/**
 * Seuils sur la largeur intérieure de la barre, calés sur 1280 / 768 px
 * d'écran une fois la barre latérale (256 px) et les marges retirées :
 * en mode compact, une colonne (largeur / 7) garde ≥ 77 px, assez pour le
 * plus long libellé (« Financement », « Feasibility ») en petit corps.
 * En dessous : les 7 cercles seuls, sur une ligne, et le libellé de
 * l'étape affichée sous la barre.
 */
export const SEUILS_BARRE = { complet: 900, compact: 540 } as const;

export function modeBarre(largeur: number): ModeBarre {
  if (largeur >= SEUILS_BARRE.complet) return "complet";
  if (largeur >= SEUILS_BARRE.compact) return "compact";
  return "cercles";
}

/** Un seul état visuel par étape ; inconnu (chargement) = à faire. */
export function etatVisuel(etat: EtatEtape | undefined): EtatEtape {
  return etat ?? "a_faire";
}

/** Segment entre l'étape i et i+1 : primaire seulement entre deux étapes terminées. */
export function segmentTermine(etats: (EtatEtape | undefined)[], i: number): boolean {
  return etats[i] === "termine" && etats[i + 1] === "termine";
}
