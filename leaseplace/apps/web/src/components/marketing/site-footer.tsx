import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LegalNotice } from "@/components/legal-notice";
import { Link } from "@/i18n/navigation";
import { brand } from "@/lib/brand";
import { SECTORS } from "@/lib/sectors";

export async function SiteFooter() {
  const t = await getTranslations("marketing.footer");
  const tSectors = await getTranslations("sectors");
  const columns = [
    {
      title: t("product"),
      links: [
        { href: "/simulateur", label: t("simulator") },
        { href: "/connexion", label: t("signIn") },
      ],
    },
    {
      title: t("sectors"),
      links: SECTORS.map((s) => ({ href: `/secteurs/${s}`, label: tSectors(`${s}.name`) })),
    },
    {
      title: t("company"),
      links: [
        { href: "/bailleurs", label: t("forLessors") },
        { href: "/mentions-legales", label: t("legal") },
      ],
    },
  ];
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <Logo />
          <LegalNotice className="max-w-sm" />
        </div>
        {columns.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-[13px] font-semibold text-fg">{c.title}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[14px] text-fg-muted hover:text-fg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-fg-subtle">
          {t("rights", { year: new Date().getFullYear(), brand: brand.name })}
        </p>
      </div>
    </footer>
  );
}
