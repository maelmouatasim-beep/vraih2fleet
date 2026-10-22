import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Simulator } from "@/components/simulator/simulator";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { parseSimulatorParams } from "@/lib/simulator-params";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "simulator" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/simulateur",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Simulateur public : calcul en direct par le moteur de packages/domain. */
export default async function SimulatorPage({ searchParams }: Props) {
  const t = await getTranslations("simulator");
  const initial = parseSimulatorParams(await searchParams);
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-8 pb-16">
      <p className="text-[13px] font-medium text-accent-strong">{t("eyebrow")}</p>
      <h1 className="mt-2 font-display text-[32px] leading-tight font-medium tracking-tight text-fg md:text-[40px]">
        {t("title")}
      </h1>
      <p className="mt-2 max-w-2xl text-[15px] text-fg-muted">{t("subtitle")}</p>
      <div className="mt-8">
        <Simulator initial={initial} />
      </div>
    </div>
  );
}
