import { ArrowRight, FileCheck2, Scale, Send } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@leaseplace/ui/button";
import { Zellige } from "@leaseplace/ui/zellige";
import { Logo } from "@/components/brand/logo";
import { LegalNotice } from "@/components/legal-notice";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Link } from "@/i18n/navigation";
import { brand } from "@/lib/brand";
import { isDemoMode } from "@/lib/demo";

const STEPS = [
  { key: "one", icon: FileCheck2 },
  { key: "two", icon: Send },
  { key: "three", icon: Scale },
] as const;

/** Accueil public provisoire (la landing complète arrive en phase 3). */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Voie prise en charge sous Next 15 (next/root-params : Next 16).
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  setRequestLocale(locale);
  const t = await getTranslations("home");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-5">
        <Logo />
        <div className="ms-auto flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <Button asChild variant="secondary" size="sm" className="ms-1">
            <Link href="/connexion">{t("signIn")}</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border">
          <Zellige className="absolute inset-0 text-primary/[0.06]" size={72} />
          <div className="relative mx-auto max-w-6xl px-5 pt-20 pb-24 md:pt-28">
            <p className="text-[13px] font-medium text-accent-strong">{t("eyebrow")}</p>
            <h1 className="mt-4 max-w-3xl font-display text-[40px] leading-[1.08] font-medium tracking-tight text-balance text-fg md:text-[56px]">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-fg-muted">
              {t("subtitle", { brand: brand.name })}
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              <Button asChild size="lg">
                <Link href="/connexion">
                  {t("cta")}
                  <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
              {isDemoMode() ? (
                <Button asChild size="lg" variant="secondary">
                  <Link href="/demo">{t("demo")}</Link>
                </Button>
              ) : null}
            </div>
            <p className="mt-4 text-[13px] text-fg-subtle">{t("simulatorSoon")}</p>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-5 py-16 md:grid-cols-3">
          {STEPS.map(({ key, icon: Icon }) => (
            <div key={key} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex size-9 items-center justify-center rounded-md bg-primary-soft text-primary-soft-fg [&_svg]:size-4">
                <Icon aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-[15px] font-semibold text-fg">{t(`steps.${key}.title`)}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                {t(`steps.${key}.body`)}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <LegalNotice />
        </div>
      </footer>
    </div>
  );
}
