/**
 * Tarifs de l'API Claude utilisés pour ESTIMER le coût de l'IA par
 * organisation (affichage seulement — la facture réelle est celle
 * d'Anthropic). Source : grille tarifaire officielle de l'API Anthropic
 * (claude-opus-5-5 : 4 $ US / million de jetons en entrée, 20 $ US en
 * sortie, 0,20 $ US en lecture de cache), consultée le 2026-10-03 via la
 * documentation de l'API. Montants en DOLLARS AMÉRICAINS (devise de
 * facturation d'Anthropic), jamais convertis en CAD sans taux sourcé.
 */
export const TARIFS_USD_PAR_MILLION: Record<string, { entree: number; sortie: number; lectureCache: number }> = {
  "claude-opus-5-5": { entree: 4, sortie: 20, lectureCache: 0.2 },
};
export const DATE_TARIFS = "2026-10-03";

export function coutEstimeUsd(
  modele: string,
  jetons: { entree: number; sortie: number; lectureCache: number },
): number | null {
  const t = TARIFS_USD_PAR_MILLION[modele];
  if (!t) return null;
  return (jetons.entree * t.entree + jetons.sortie * t.sortie + jetons.lectureCache * t.lectureCache) / 1_000_000;
}
