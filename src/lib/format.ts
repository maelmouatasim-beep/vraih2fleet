/** Formatage monétaire CAD selon la langue de l'interface. */
export function formateurCad(langue: string, maximumFractionDigits = 0): Intl.NumberFormat {
  return new Intl.NumberFormat(langue.startsWith("fr") ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits,
  });
}

/** Formatage compact (12 k$, 1,3 M$) pour les graphiques. */
export function formateurCadCompact(langue: string): Intl.NumberFormat {
  return new Intl.NumberFormat(langue.startsWith("fr") ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}
