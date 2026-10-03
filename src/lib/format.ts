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

/** Locale Intl de l'interface (fr-CA par défaut). */
export function localeDe(langue: string): "fr-CA" | "en-CA" {
  return langue.startsWith("en") ? "en-CA" : "fr-CA";
}

/** Nombre selon la langue : 12 345 (fr-CA, espace insécable) ou 12,345 (en-CA). */
export function formateurNombre(langue: string, maximumFractionDigits = 0): Intl.NumberFormat {
  return new Intl.NumberFormat(localeDe(langue), { maximumFractionDigits });
}

/** Pourcentage depuis une fraction : 0,05 → « 5,0 % » (fr-CA, insécable) ou « 5.0% ». */
export function formaterPourcentage(langue: string, fraction: number, decimales = 1): string {
  return new Intl.NumberFormat(localeDe(langue), {
    style: "percent",
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(fraction);
}

/** Date courte selon la langue (AAAA-MM-JJ en fr-CA et en-CA). */
export function formaterDate(langue: string, date: string | Date): string {
  return new Date(date).toLocaleDateString(localeDe(langue));
}
