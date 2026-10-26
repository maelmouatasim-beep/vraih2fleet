import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@leaseplace/ui/button";
import { Faq, faqJsonLd } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { QuickSimulator } from "@/components/marketing/quick-simulator";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requestContext } from "@/lib/request";
import { isSector, SECTOR_EXAMPLES } from "@/lib/sectors";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }> };

// Rendu à la demande : la CSP exige un nonce par requête (ADR 0007). Une
// génération statique par secteur rendait les versions ar et en en erreur 500.

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSector(slug)) return {};
  const t = await getTranslations({ locale, namespace: `sectors.${slug}` });
  return pageMetadata({
    locale: locale as Locale,
    path: `/secteurs/${slug}`,
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

const ITEMS = ["e1", "e2", "e3", "e4", "e5"] as const;
const POINTS = ["c1", "c2", "c3"] as const;
const QUESTIONS = ["q1", "q2", "q3"] as const;

/** Page sectorielle : besoins types, points d'attention, simulateur prérempli (exemple illustratif). */
export default async function SectorPage({ params }: Props) {
  const { slug } = await params;
  if (!isSector(slug)) notFound();
  const t = await getTranslations(`sectors.${slug}`);
  const common = await getTranslations("sectors.common");
  const { nonce } = await requestContext();
  const faq = QUESTIONS.map((k) => ({ q: t(`faq.${k}.q`), a: t(`faq.${k}.a`) }));
  return (
    <>
      <JsonLd nonce={nonce} data={faqJsonLd(faq)} />
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-5 pt-10 pb-16 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="text-[13px] font-medium text-accent-strong">
              {common("eyebrow", { sector: t("name") })}
            </p>
            <h1 className="mt-3 font-display text-[36px] leading-[1.1] font-medium tracking-tight text-balance text-fg md:text-[48px]">
              {t("title")}
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-fg-muted">{t("intro")}</p>
            <h2 className="mt-8 text-[14px] font-semibold text-fg">{common("equipmentTitle")}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {ITEMS.map((k) => (
                <li key={k} className="flex items-start gap-2 text-[14px] text-fg-muted">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {t(`equipment.${k}`)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <QuickSimulator preset={SECTOR_EXAMPLES[slug]} />
            <p className="mt-3 text-[12px] text-fg-subtle">{common("exampleNote")}</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-[28px] leading-tight font-medium tracking-tight text-fg">
          {common("pointsTitle")}
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {POINTS.map((k) => (
            <div key={k} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <h3 className="text-[15px] font-semibold text-fg">{t(`points.${k}.title`)}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-fg-muted">
                {t(`points.${k}.body`)}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 lg:grid-cols-[1fr_1.5fr]">
        <div>
          <h2 className="font-display text-[28px] leading-tight font-medium tracking-tight text-fg">
            {common("faqTitle")}
          </h2>
          <Button asChild className="mt-6">
            <Link href="/simulateur">
              {common("simulateCta")}
              <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <Faq items={faq} />
      </section>
    </>
  );
}
