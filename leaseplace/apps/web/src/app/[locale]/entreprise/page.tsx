import { ArrowRight, FileStack, FolderLock, Lock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@leaseplace/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@leaseplace/ui/card";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { KycProgress } from "@/components/company/kyc";
import { NewRequestButton } from "@/components/company/request-buttons";
import { RequestList } from "@/components/company/request-list";
import { PageHeader } from "@/components/shell/shells";
import { Link } from "@/i18n/navigation";
import { getCompany, kycState, listDocuments, listRequests } from "@/lib/company-data";
import { loadCompanyPage } from "@/lib/company-page";
import { createRequestAction } from "./actions";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "spaces.company" });
  return { title: t("name") };
}

export default async function CompanyHome({ params }: Props) {
  const { locale } = await params;
  const { viewer, kyc, requests } = await loadCompanyPage(locale, async (tx, v) => {
    const company = await getCompany(tx, v.membership.organizationId);
    const docs = await listDocuments(tx, v.membership.organizationId);
    return {
      kyc: company ? kycState(company, docs) : null,
      requests: await listRequests(tx, v.membership.organizationId),
    };
  });
  const t = await getTranslations("spaces.company");
  const firstName = viewer.user.name.split(" ")[0] ?? viewer.user.name;
  const missing = kyc ? kyc.completeness.items.filter((i) => i.state !== "ok").length : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("greeting", { name: firstName })}
        description={viewer.membership.organizationName}
        actions={requests.length > 0 ? <NewRequestButton action={createRequestAction} /> : null}
      />

      {kyc ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderLock className="size-4 text-primary" aria-hidden="true" />
                {t("kycTitle")}
              </CardTitle>
              <CardDescription>
                {kyc.completeness.complete ? t("kycComplete") : t("kycMissing", { count: missing })}
              </CardDescription>
            </div>
            <Button asChild variant={kyc.completeness.complete ? "ghost" : "secondary"} size="sm">
              <Link href="/entreprise/coffre-fort">
                {t("openVault")}
                <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <KycProgress completeness={kyc.completeness} />
          </CardContent>
        </Card>
      ) : null}

      {requests.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-fg">{t("recentRequests")}</h2>
            <Link
              href="/entreprise/demandes"
              className="text-[13px] font-medium text-primary underline-offset-2 hover:underline"
            >
              {t("allRequests")}
            </Link>
          </div>
          <RequestList requests={requests.slice(0, 5)} />
        </section>
      ) : (
        <EmptyState
          icon={<FileStack />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={<NewRequestButton action={createRequestAction} size="lg" />}
        />
      )}

      <Card className="bg-primary-soft/40">
        <CardContent className="flex gap-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-[13px] font-medium text-fg">{t("privacyTitle")}</p>
            <p className="mt-0.5 text-[13px] text-fg-muted">{t("privacyBody")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
