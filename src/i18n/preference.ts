/**
 * E3 — Préférence de langue. PUR (testé, stockage injecté).
 * Avant : le détecteur MÉMORISAIT automatiquement la langue détectée
 * (clé « h2fleet-language ») — un visiteur passé une fois en anglais
 * (ancien défaut, navigateur partagé…) restait bloqué en anglais.
 * Maintenant : seule une préférence CHOISIE via le sélecteur est
 * mémorisée (clé « h2fleet-language-choice ») ; l'ancienne clé est
 * purgée une fois, et la détection (navigateur → français) reprend.
 */
export const CLE_CHOIX_LANGUE = "h2fleet-language-choice";
export const ANCIENNE_CLE_LANGUE = "h2fleet-language";

export interface StockageSimple {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
  removeItem(cle: string): void;
}

/** Purge l'ancienne langue auto-mémorisée (idempotent). */
export function migrerPreferenceLangue(stockage: StockageSimple | null): void {
  if (!stockage) return;
  try {
    if (stockage.getItem(ANCIENNE_CLE_LANGUE) !== null) stockage.removeItem(ANCIENNE_CLE_LANGUE);
  } catch {
    // stockage indisponible (navigation privée…) : rien à migrer
  }
}

/** Mémorise un CHOIX explicite de l'utilisateur. */
export function memoriserChoixLangue(stockage: StockageSimple | null, langue: "fr" | "en"): void {
  try {
    stockage?.setItem(CLE_CHOIX_LANGUE, langue);
  } catch {
    // ignoré : la langue reste appliquée pour la session
  }
}

/** Langue « courte » à partir d'un code i18next (fr-CA → fr). */
export function langueCourte(code: string | undefined | null): "fr" | "en" {
  return code?.toLowerCase().startsWith("en") ? "en" : "fr";
}

/** Valeur de l'attribut <html lang> (produit canadien). */
export function langueHtml(code: string | undefined | null): "fr-CA" | "en-CA" {
  return langueCourte(code) === "en" ? "en-CA" : "fr-CA";
}
