import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@leaseplace/ui/card";
import { DocumentTable, KycChecklist, KycProgress } from "@/components/company/kyc";
import { UploadForm } from "@/components/company/upload-form";
import { PageHeader } from "@/components/shell/shells";
import { getCompany, kycState, listDocuments } from "@/lib/company-data";
import { loadCompanyPage } from "@/lib/company-page";
import { uploadDocumentAction } from "../actions";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "company.vault" });
  return { title: t("title") };
}

/** Coffre-fort KYC : pièces exigées selon la forme juridique, dépôt, téléchargement signé. */
export default async function Vault({ params }: Props) {
  const { locale } = await params;
  const { viewer, kyc, docs } = await loadCompanyPage(locale, async (tx, v) => {
    const company = await getCompany(tx, v.membership.organizationId);
    const docs = await listDocuments(tx, v.membership.organizationId);
    return { kyc: company ? kycState(company, docs) : null, docs };
  });
  const t = await getTranslations("company.vault");
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {kyc ? (
        <section className="flex flex-col gap-4" aria-labelledby="pieces-exigees">
          <h2 id="pieces-exigees" className="text-[15px] font-semibold text-fg">
            {t("requiredTitle")}
          </h2>
          <KycProgress completeness={kyc.completeness} />
          <KycChecklist completeness={kyc.completeness} />
        </section>
      ) : null}
      <section className="flex flex-col gap-4" aria-labelledby="documents-deposes">
        <h2 id="documents-deposes" className="text-[15px] font-semibold text-fg">
          {t("documentsTitle")}
        </h2>
        <DocumentTable documents={docs} userId={viewer.user.id} />
        <Card>
          <CardContent>
            <h3 className="mb-3 text-[14px] font-semibold text-fg">{t("otherTitle")}</h3>
            <UploadForm action={uploadDocumentAction} />
          </CardContent>
        </Card>
        <p className="text-[12px] text-fg-subtle">{t("securityNote")}</p>
      </section>
    </div>
  );
}
