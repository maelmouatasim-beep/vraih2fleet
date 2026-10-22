import { Menu } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@leaseplace/ui/button";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";
import { LocaleLinks, ThemeButton } from "./public-controls";

const LINKS = [
  { href: "/simulateur", key: "simulator" },
  { href: "/secteurs/transport", key: "sectors" },
  { href: "/bailleurs", key: "lessors" },
] as const;

/** En-tête public léger : aucun composant de menu à charger. */
export async function SiteHeader() {
  const t = await getTranslations("marketing.nav");
  return (
    <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link href="/" aria-label={t("home")}>
          <Logo />
        </Link>
        <nav aria-label={t("label")} className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className="rounded-md px-3 py-2 text-[14px] text-fg-muted transition-colors hover:text-fg"
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <div className="hidden sm:block">
            <LocaleLinks />
          </div>
          <ThemeButton />
          <Button asChild variant="secondary" size="sm" className="ms-1 hidden sm:inline-flex">
            <Link href="/connexion">{t("signIn")}</Link>
          </Button>
          <details className="group relative md:hidden">
            <summary
              className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted [&::-webkit-details-marker]:hidden"
              aria-label={t("menu")}
            >
              <Menu className="size-5" aria-hidden="true" />
            </summary>
            <div className="absolute end-0 top-11 z-50 flex w-60 flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg">
              {LINKS.map((l) => (
                <Link
                  key={l.key}
                  href={l.href}
                  className="rounded-md px-3 py-2 text-[14px] text-fg hover:bg-surface-muted"
                >
                  {t(l.key)}
                </Link>
              ))}
              <Link
                href="/connexion"
                className="rounded-md px-3 py-2 text-[14px] text-fg hover:bg-surface-muted"
              >
                {t("signIn")}
              </Link>
              <div className="border-t border-border pt-2 sm:hidden">
                <LocaleLinks />
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
