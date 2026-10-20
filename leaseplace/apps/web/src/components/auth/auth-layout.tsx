import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Zellige } from "@leaseplace/ui/zellige";
import { Logo, LogoMark } from "@/components/brand/logo";
import { LegalNotice } from "@/components/legal-notice";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Link } from "@/i18n/navigation";
import { brand } from "@/lib/brand";

/** Écran partagé des pages d'authentification : panneau de marque + formulaire. */
export async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("auth");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-brand p-10 text-brand-fg lg:flex lg:flex-col">
        <Zellige className="absolute inset-0 text-brand-fg/[0.07]" size={64} />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-brand-deep to-transparent" />
        <div className="relative flex items-center gap-2">
          <LogoMark className="[&_rect:first-child]:fill-brand-fg/10" />
          <span className="text-[15px] font-semibold">{brand.name}</span>
        </div>
        <div className="relative mt-auto max-w-md">
          <p className="font-display text-[34px] leading-[1.15] font-medium tracking-tight text-balance">
            {t("panelTitle")}
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-fg/75">{t("panelBody")}</p>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-brand-fg/15 pt-6">
            {(["one", "two", "three"] as const).map((k) => (
              <div key={k}>
                <dt className="text-[12px] text-brand-fg/60">{t(`panelFacts.${k}.label`)}</dt>
                <dd className="mt-1 text-[15px] font-medium">{t(`panelFacts.${k}.value`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
      <div className="flex flex-col">
        <header className="flex h-14 items-center justify-between px-5">
          <Link href="/" className="lg:invisible">
            <Logo subtle />
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-5 py-10">
          <div className="w-full max-w-[400px] animate-rise">{children}</div>
        </main>
        <footer className="px-5 pb-6">
          <LegalNotice className="mx-auto max-w-[400px]" />
        </footer>
      </div>
    </div>
  );
}
