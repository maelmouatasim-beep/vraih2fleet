import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { brand } from "./brand";
import { isDemoMode } from "./demo";

/** URL publique du site (SITE_URL, sinon l'URL d'authentification). */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

/** Chemin localisé : français sans préfixe, arabe et anglais préfixés. */
export function localizedPath(locale: Locale, path: string): string {
  const clean = path === "/" ? "" : path;
  return locale === routing.defaultLocale ? clean || "/" : `/${locale}${clean}`;
}

const OG_LOCALE: Readonly<Record<Locale, string>> = { fr: "fr_MA", ar: "ar_MA", en: "en_US" };

/** Métadonnées d'une page publique : canonique, hreflang, Open Graph. */
export function pageMetadata({
  locale,
  path,
  title,
  description,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
}): Metadata {
  const base = siteUrl();
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `${base}${localizedPath(l, path)}`]),
  );
  const url = `${base}${localizedPath(locale, path)}`;
  return {
    title,
    description,
    metadataBase: new URL(base),
    alternates: {
      canonical: url,
      languages: { ...languages, "x-default": languages[routing.defaultLocale] ?? url },
    },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: brand.name,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
    twitter: { card: "summary_large_image", title, description },
    robots: isDemoMode() ? { index: false, follow: false } : { index: true, follow: true },
  };
}

/** Pages publiques indexables (sitemap). */
export const PUBLIC_PATHS = [
  "/",
  "/simulateur",
  "/bailleurs",
  "/secteurs/transport",
  "/secteurs/btp",
  "/secteurs/medical",
  "/mentions-legales",
] as const;
