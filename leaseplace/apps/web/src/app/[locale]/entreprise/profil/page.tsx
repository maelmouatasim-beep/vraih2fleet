import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { can } from "@leaseplace/domain";
import { Card, CardContent } from "@leaseplace/ui/card";
import { ProfileForm } from "@/components/company/profile-form";
import { PageHeader } from "@/components/shell/shells";
import { getCompany } from "@/lib/company-data";
import { loadCompanyPage } from "@/lib/company-page";
import { formatDate } from "@/lib/format";
import { updateProfileAction } from "../actions";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "company.profile" });
  return { title: t("title") };
}

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function Profile({ params }: Props) {
  const { locale } = await params;
  const { viewer, company } = await loadCompanyPage(locale, async (tx, v) => ({
    company: await getCompany(tx, v.membership.organizationId),
  }));
  const t = await getTranslations("company.profile");
  const to = await getTranslations("company.onboarding");
  const tl = await getTranslations("company.labels");
  if (!company) return <PageHeader title={t("title")} />;
  const identity: readonly (readonly [string, string])[] = [
    [to("legalName"), company.legalName],
    [to("ice"), company.ice],
    [to("legalForm"), tl(`legalForms.${company.legalForm}`)],
    [t("createdOn"), formatDate(company.createdAt)],
  ];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Card>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
            {identity.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-border pb-2">
                <dt className="text-fg-muted">{k}</dt>
                <dd className="tabular text-end font-medium text-fg">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[12px] text-fg-subtle">{t("identityNote")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <ProfileForm
            action={updateProfileAction}
            readOnly={!can(viewer.membership.role, "organization.manage_members")}
            values={{
              tradeName: company.tradeName ?? "",
              rcNumber: company.rcNumber ?? "",
              rcCourt: company.rcCourt ?? "",
              taxId: company.taxId ?? "",
              cnssNumber: company.cnssNumber ?? "",
              address: company.address ?? "",
              city: company.city,
              sector: company.sector,
              incorporationDate: isoDate(company.incorporationDate),
              revenueBand: company.revenueBand ?? "",
              headcountBand: company.headcountBand ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
