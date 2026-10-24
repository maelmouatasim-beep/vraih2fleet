import { FileStack } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { NewRequestButton } from "@/components/company/request-buttons";
import { RequestList } from "@/components/company/request-list";
import { PageHeader } from "@/components/shell/shells";
import { listRequests } from "@/lib/company-data";
import { loadCompanyPage } from "@/lib/company-page";
import { createRequestAction } from "../actions";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "company.requests" });
  return { title: t("title") };
}

export default async function Requests({ params }: Props) {
  const { locale } = await params;
  const { requests } = await loadCompanyPage(locale, async (tx, v) => ({
    requests: await listRequests(tx, v.membership.organizationId),
  }));
  const t = await getTranslations("company.requests");
  const ts = await getTranslations("spaces.company");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={<NewRequestButton action={createRequestAction} />}
      />
      {requests.length > 0 ? (
        <RequestList requests={requests} />
      ) : (
        <EmptyState icon={<FileStack />} title={ts("emptyTitle")} description={ts("emptyBody")} />
      )}
    </div>
  );
}
