/**
 * Paramètres financiers d'un projet — PUR (testé).
 * Convention unique (migration 20260930010000) : le taux d'actualisation
 * est stocké en FRACTION décimale (0.05 = 5 %). Une valeur >= 1 ne peut
 * venir que d'un ancien instantané (pourcentage) : elle est convertie,
 * jamais utilisée telle quelle.
 */
export function tauxActualisationDepuisProjet(valeurStockee: number): number {
  if (!Number.isFinite(valeurStockee) || valeurStockee < 0) {
    throw new Error(`taux d'actualisation invalide : ${valeurStockee}`);
  }
  return valeurStockee >= 1 ? valeurStockee / 100 : valeurStockee;
}

/** Saisie écran en pour cent (« 5 » ou « 5,5 ») → fraction stockée ; null si illisible. */
export function tauxDepuisSaisiePourcent(saisie: string): number | null {
  const n = Number(saisie.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n >= 100) return null;
  return n / 100;
}
