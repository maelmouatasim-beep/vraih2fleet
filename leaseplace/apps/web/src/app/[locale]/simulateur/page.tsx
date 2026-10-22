import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@leaseplace/ui/button";
import { Logo } from "@/components/brand/logo";
import { LegalNotice } from "@/components/legal-notice";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Simulator } from "@/components/simulator/simulator";
import { Link } from "@/i18n/navigation";
import { parseSimulatorParams } from "@/lib/simulator";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "simulator" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** Simulateur public : calcul en direct par le moteur de packages/domain. */
export default async function SimulatorPage({ searchParams }: Props) {
  const t = await getTranslations("simulator");
  const initial = parseSimulatorParams(await searchParams);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-5">
        <Link href="/">
          <Logo />
        </Link>
        <div className="ms-auto flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <Button asChild variant="secondary" size="sm" className="ms-1">
            <Link href="/connexion">{t("signIn")}</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-6 pb-16">
        <p className="text-[13px] font-medium text-accent-strong">{t("eyebrow")}</p>
        <h1 className="mt-2 font-display text-[32px] leading-tight font-medium tracking-tight text-fg md:text-[40px]">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-fg-muted">{t("subtitle")}</p>
        <div className="mt-8">
          <Simulator initial={initial} />
        </div>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <LegalNotice />
        </div>
      </footer>
    </div>
  );
}
