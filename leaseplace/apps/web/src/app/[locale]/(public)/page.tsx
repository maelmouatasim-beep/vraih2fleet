import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileCheck2,
  Gauge,
  HeartPulse,
  Lock,
  Scale,
  Send,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@leaseplace/ui/button";
import { Zellige } from "@leaseplace/ui/zellige";
import { ComparatorPreview } from "@/components/marketing/comparator-preview";
import { Faq, faqJsonLd } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { QuickSimulator } from "@/components/marketing/quick-simulator";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { brand } from "@/lib/brand";
import { requestContext } from "@/lib/request";
import { SECTORS, type Sector } from "@/lib/sectors";
import { pageMetadata, siteUrl } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/",
    title: t("metaTitle", { brand: brand.name }),
    description: t("metaDescription"),
  });
}

const STEPS: readonly { key: string; icon: LucideIcon }[] = [
  { key: "one", icon: FileCheck2 },
  { key: "two", icon: ShieldCheck },
  { key: "three", icon: Send },
  { key: "four", icon: Scale },
];
const TRUST: readonly { key: string; icon: LucideIcon }[] = [
  { key: "mandate", icon: BadgeCheck },
  { key: "decision", icon: Gauge },
  { key: "data", icon: Lock },
  { key: "security", icon: ShieldCheck },
];
const SECTOR_ICONS: Readonly<Record<Sector, LucideIcon>> = {
  transport: Truck,
  btp: Building2,
  medical: HeartPulse,
};
const FAQ_KEYS = [
  "intermediary",
  "free",
  "decision",
  "data",
  "lessors",
  "delay",
  "score",
  "commission",
] as const;

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? <p className="text-[13px] font-medium text-accent-strong">{eyebrow}</p> : null}
      <h2 className="mt-2 font-display text-[30px] leading-tight font-medium tracking-tight text-balance text-fg md:text-[36px]">
        {title}
      </h2>
      {body ? <p className="mt-3 text-[16px] leading-relaxed text-fg-muted">{body}</p> : null}
    </div>
  );
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  // Voie prise en charge sous Next 15 (next/root-params : Next 16).
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tSectors = await getTranslations("sectors");
  const { nonce } = await requestContext();
  const faq = FAQ_KEYS.map((k) => ({
    q: t(`faq.items.${k}.q`, { brand: brand.name }),
    a: t(`faq.items.${k}.a`, { brand: brand.name }),
  }));

  return (
    <>
      <JsonLd
        nonce={nonce}
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: brand.name,
            url: siteUrl(),
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: brand.name,
            url: siteUrl(),
            inLanguage: locale,
          },
          faqJsonLd(faq),
        ]}
      />

      <section className="relative overflow-hidden border-b border-border">
        <Zellige className="absolute inset-0 text-primary/[0.05]" size={72} />
        {/* Mobile : titre, puis simulateur (au-dessus de la ligne de flottaison), puis le reste. */}
        <div className="relative mx-auto grid max-w-6xl gap-x-10 gap-y-7 px-5 pt-8 pb-16 md:pt-16 lg:grid-cols-[1.15fr_1fr] lg:pb-24">
          <div className="lg:col-start-1 lg:self-end">
            <p className="text-[13px] font-medium text-accent-strong">{t("eyebrow")}</p>
            <h1 className="mt-3 font-display text-[34px] leading-[1.08] font-medium tracking-tight text-balance text-fg md:mt-4 md:text-[58px]">
              {t("title")}
            </h1>
          </div>
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
            <QuickSimulator />
          </div>
          <div className="lg:col-start-1">
            <p className="max-w-xl text-[17px] leading-relaxed text-fg-muted">
              {t("subtitle", { brand: brand.name })}
            </p>
            <ul className="mt-6 grid max-w-xl gap-3 sm:grid-cols-3">
              {(["free", "neutral", "fast"] as const).map((k) => (
                <li key={k} className="flex items-start gap-2 text-[14px] text-fg">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{t(`pillars.${k}`)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-2">
              <Button asChild size="lg">
                <Link href="/simulateur">
                  {t("cta")}
                  <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/bailleurs">{t("ctaLessors")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading eyebrow={t("how.eyebrow")} title={t("how.title")} body={t("how.body")} />
        <ol className="mt-10 grid gap-4 md:grid-cols-4">
          {STEPS.map(({ key, icon: Icon }, i) => (
            <li key={key} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary-soft text-primary-soft-fg [&_svg]:size-4">
                  <Icon aria-hidden="true" />
                </span>
                <span className="tabular font-mono text-[12px] text-fg-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-fg">
                {t(`how.steps.${key}.title`)}
              </h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-fg-muted">
                {t(`how.steps.${key}.body`)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-border bg-surface-muted/50">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 lg:grid-cols-2">
          <SectionHeading
            eyebrow={t("preview.eyebrow")}
            title={t("preview.title")}
            body={t("preview.body")}
          />
          <ComparatorPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20" id="secteurs">
        <SectionHeading
          eyebrow={t("sectorsSection.eyebrow")}
          title={t("sectorsSection.title")}
          body={t("sectorsSection.body")}
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {SECTORS.map((s) => {
            const Icon = SECTOR_ICONS[s];
            return (
              <Link
                key={s}
                href={`/secteurs/${s}`}
                className="group flex flex-col rounded-lg border border-border bg-surface p-5 shadow-sm transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-md"
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-accent-soft text-accent-strong [&_svg]:size-4">
                  <Icon aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-fg">{tSectors(`${s}.name`)}</h3>
                <p className="mt-1.5 flex-1 text-[14px] leading-relaxed text-fg-muted">
                  {tSectors(`${s}.teaser`)}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-primary">
                  {t("sectorsSection.cta")}
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="bg-brand text-brand-fg">
        <div className="relative mx-auto max-w-6xl overflow-hidden px-5 py-20">
          <Zellige className="absolute inset-0 text-brand-fg/[0.06]" size={64} />
          <div className="relative max-w-2xl">
            <p className="text-[13px] font-medium text-brand-fg/70">{t("trust.eyebrow")}</p>
            <h2 className="mt-2 font-display text-[30px] leading-tight font-medium tracking-tight md:text-[36px]">
              {t("trust.title")}
            </h2>
          </div>
          <div className="relative mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ key, icon: Icon }) => (
              <div key={key} className="border-t border-brand-fg/20 pt-5">
                <Icon className="size-5 text-brand-fg/80" aria-hidden="true" />
                <h3 className="mt-3 text-[15px] font-semibold">{t(`trust.items.${key}.title`)}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-brand-fg/75">
                  {t(`trust.items.${key}.body`, { brand: brand.name })}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-8 rounded-xl border border-border bg-surface p-8 shadow-sm md:grid-cols-[1.4fr_auto] md:p-10">
          <div>
            <p className="text-[13px] font-medium text-accent-strong">
              {t("lessorsTeaser.eyebrow")}
            </p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-fg">
              {t("lessorsTeaser.title")}
            </h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-fg-muted">
              {t("lessorsTeaser.body", { brand: brand.name })}
            </p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/bailleurs">
              {t("lessorsTeaser.cta")}
              <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 lg:grid-cols-[1fr_1.5fr]">
        <SectionHeading eyebrow={t("faq.eyebrow")} title={t("faq.title")} body={t("faq.body")} />
        <Faq items={faq} />
      </section>

      <section className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-5 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-[28px] leading-tight font-medium tracking-tight text-fg">
              {t("final.title")}
            </h2>
            <p className="mt-2 text-[15px] text-fg-muted">{t("final.body")}</p>
          </div>
          <Button asChild size="lg">
            <Link href="/simulateur">
              {t("cta")}
              <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
