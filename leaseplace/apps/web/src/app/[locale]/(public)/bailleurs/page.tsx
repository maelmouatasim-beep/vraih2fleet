import {
  BadgeCheck,
  Clock,
  FileSearch,
  Filter,
  Lock,
  Percent,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LeadForm } from "@/components/marketing/lead-form";
import type { Locale } from "@/i18n/routing";
import { brand } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";
import { submitLead } from "./actions";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lessorsPage" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/bailleurs",
    title: t("metaTitle"),
    description: t("metaDescription", { brand: brand.name }),
  });
}

const BENEFITS: readonly { key: string; icon: LucideIcon }[] = [
  { key: "qualified", icon: FileSearch },
  { key: "appetite", icon: Filter },
  { key: "decision", icon: BadgeCheck },
  { key: "sla", icon: Clock },
  { key: "success", icon: Percent },
  { key: "security", icon: Lock },
];
const STEPS = ["s1", "s2", "s3", "s4"] as const;

export default async function LessorsPage() {
  const t = await getTranslations("lessorsPage");
  return (
    <>
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 pt-12 pb-16">
          <p className="text-[13px] font-medium text-accent-strong">{t("eyebrow")}</p>
          <h1 className="mt-3 max-w-3xl font-display text-[36px] leading-[1.1] font-medium tracking-tight text-balance text-fg md:text-[52px]">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-fg-muted">
            {t("subtitle", { brand: brand.name })}
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ key, icon: Icon }) => (
            <div key={key} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-md bg-primary-soft text-primary-soft-fg [&_svg]:size-4">
                <Icon aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-[15px] font-semibold text-fg">
                {t(`benefits.${key}.title`)}
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-fg-muted">
                {t(`benefits.${key}.body`, { brand: brand.name })}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="border-y border-border bg-surface-muted/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-[28px] leading-tight font-medium tracking-tight text-fg">
              {t("howTitle")}
            </h2>
            <ol className="mt-6 flex flex-col gap-4">
              {STEPS.map((k, i) => (
                <li key={k} className="flex gap-4">
                  <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-fg">
                    {i + 1}
                  </span>
                  <p className="text-[15px] leading-relaxed text-fg-muted">
                    {t(`steps.${k}`, { brand: brand.name })}
                  </p>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-[17px] font-semibold text-fg">{t("commissionTitle")}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">{t("commissionBody")}</p>
          </div>
        </div>
      </section>
      <section
        className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1fr_1.4fr]"
        id="contact"
      >
        <div>
          <h2 className="font-display text-[28px] leading-tight font-medium tracking-tight text-fg">
            {t("formTitle")}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">{t("formSubtitle")}</p>
        </div>
        <div className="relative rounded-xl border border-border bg-surface p-6 shadow-sm">
          <LeadForm action={submitLead} kind="lessor" />
        </div>
      </section>
    </>
  );
}
