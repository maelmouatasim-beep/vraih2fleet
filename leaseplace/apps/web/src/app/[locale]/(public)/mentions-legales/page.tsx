import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Alert } from "@leaseplace/ui/alert";
import type { Locale } from "@/i18n/routing";
import { brand } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legalPage" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/mentions-legales",
    title: t("title"),
    description: t("description", { brand: brand.name }),
  });
}

const SECTIONS = ["publisher", "status", "data", "rights", "cookies", "hosting"] as const;

/** Mentions légales et confidentialité : brouillon, champs en attente de l'entité juridique. */
export default async function LegalPage() {
  const t = await getTranslations("legalPage");
  const values = {
    brand: brand.name,
    entity: brand.legal.entityName,
    ice: brand.legal.ice,
    rc: brand.legal.rc,
    taxId: brand.legal.taxId,
    address: brand.legal.address,
    email: brand.supportEmail,
  };
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-[36px] leading-tight font-medium tracking-tight text-fg">
        {t("title")}
      </h1>
      <Alert tone="warning" className="mt-6">
        {t("draft")}
      </Alert>
      <div className="mt-8 flex flex-col gap-8">
        {SECTIONS.map((s) => (
          <section key={s}>
            <h2 className="text-[18px] font-semibold text-fg">{t(`sections.${s}.title`)}</h2>
            <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-fg-muted">
              {t(`sections.${s}.body`, values)}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
