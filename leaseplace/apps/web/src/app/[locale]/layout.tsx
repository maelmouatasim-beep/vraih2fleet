import "../globals.css";
import "@fontsource-variable/fraunces";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { DemoBanner } from "@/components/shell/demo-banner";
import { directionOf, routing } from "@/i18n/routing";
import { brand } from "@/lib/brand";
import { isDemoMode } from "@/lib/demo";
import { requestContext } from "@/lib/request";

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
  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <Providers nonce={nonce}>
          <NextIntlClientProvider>
            {isDemoMode() ? <DemoBanner /> : null}
            {children}
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
