import "../globals.css";
// Arabe : sous-ensemble arabe seulement (le latin vient de Geist), deux graisses.
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import localFont from "next/font/local";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { DemoBanner } from "@/components/shell/demo-banner";
import { CLIENT_NAMESPACES, pickMessages } from "@/i18n/client-messages";
import { directionOf, routing } from "@/i18n/routing";
import { brand } from "@/lib/brand";
import { isDemoMode } from "@/lib/demo";
import { requestContext } from "@/lib/request";

// Interface : Geist réduite aux caractères latins (scripts/subset-fonts.sh), 33 Ko au lieu de 68.
const geist = localFont({
  src: "../../fonts/geist-latin-var.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: "Arial",
});

// Titres marketing : Fraunces auto-hébergée, préchargée (élément LCP de la landing).
const fraunces = localFont({
  src: "../../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2",
  variable: "--font-fraunces",
  weight: "100 900",
  // « optional » : jamais de changement de police après coup (ni saut, ni nouveau LCP).
  display: "optional",
  preload: true,
  fallback: ["Georgia", "serif"],
});

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { default: `${brand.name} — ${t("title")}`, template: `%s · ${brand.name}` },
    description: t("description"),
    robots: isDemoMode() ? { index: false, follow: false } : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1210" },
  ],
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Voie prise en charge sous Next 15 (next/root-params : Next 16).
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  setRequestLocale(locale);
  const { nonce } = await requestContext();
  // Seules les traductions des composants clients partent vers le navigateur.
  const messages = pickMessages(
    (await getMessages()) as Parameters<typeof pickMessages>[0],
    CLIENT_NAMESPACES,
  );
  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={`${geist.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <Providers nonce={nonce}>
          <NextIntlClientProvider messages={messages}>
            {isDemoMode() ? <DemoBanner /> : null}
            {children}
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
