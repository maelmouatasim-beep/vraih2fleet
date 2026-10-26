import { MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Badge } from "@leaseplace/ui/badge";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { PageHeader } from "@/components/shell/shells";
import { Link } from "@/i18n/navigation";
import { loadCompanyPage } from "@/lib/company-page";
import { formatDateTime } from "@/lib/format";
import { companyThreads } from "@/lib/messaging/data";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "messages" });
  return { title: t("title"), robots: { index: false } };
}

/** Questions et réponses avec les bailleurs : un fil par demande et par bailleur. */
export default async function CompanyMessages({ params }: Props) {
  const { locale } = await params;
  const { threads } = await loadCompanyPage(locale, async (tx, v) => ({
    threads: await companyThreads(tx, v.user.id, v.membership.organizationId),
  }));
  const t = await getTranslations("messages");
  return (
    <div className="flex flex-col gap-2">
      <PageHeader title={t("title")} description={t("description")} />
      {threads.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare />}
          title={t("noThreadsTitle")}
          description={t("noThreadsBody")}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {threads.map((th) => (
            <li key={th.id}>
              <Link
                href={`/entreprise/messages/${th.id}`}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-surface-muted/60"
                data-thread-row={th.lessorName}
              >
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-fg">
                    {th.lessorName}
                    <span className="tabular ms-2 font-mono text-[12px] text-fg-subtle">
                      {th.reference}
                    </span>
                  </span>
                  <span className="block truncate text-[13px] text-fg-muted">
                    {th.lastBody ?? t("noMessage")}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {th.lastMessageAt ? (
                    <span className="tabular text-[12px] text-fg-subtle">
                      {formatDateTime(th.lastMessageAt)}
                    </span>
                  ) : null}
                  {th.unread > 0 ? (
                    <Badge tone="primary">{t("unread", { count: th.unread })}</Badge>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
