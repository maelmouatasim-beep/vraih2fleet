import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "ar", "en"],
  defaultLocale: "fr",
  // Français sans préfixe (/), arabe et anglais préfixés (/ar, /en).
  localePrefix: "as-needed",
  // Pas de redirection selon la langue du navigateur (recommandation SEO) : « / » reste
  // en français ; le choix fait dans le sélecteur est mémorisé par cookie.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const RTL_LOCALES: readonly Locale[] = ["ar"];

export function directionOf(locale: Locale): "rtl" | "ltr" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}
