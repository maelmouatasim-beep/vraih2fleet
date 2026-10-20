import { Inbox } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { PageHeader, StatCard } from "@/components/shell/shells";
import type { Locale } from "@/i18n/routing";
import { requireSpace } from "@/lib/viewer";

const COLUMNS = ["reference", "company", "amount", "duration", "grade", "sla", "status"] as const;
const NUMERIC = new Set<string>(["amount", "duration", "sla"]);

export default async function LessorInbox({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const viewer = await requireSpace("lessor", locale as Locale);
  const t = await getTranslations("spaces.lessor");
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={t("inboxTitle")}
        description={t("inboxBody", { organization: viewer.membership.organizationName })}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("kpiReceived")} value="0" hint={t("kpiPeriod")} />
        <StatCard label={t("kpiPending")} value="0" hint={t("kpiSla")} />
        <StatCard label={t("kpiDelay")} value="—" />
        <StatCard label={t("kpiWinRate")} value="—" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className={`px-4 py-2.5 font-medium ${NUMERIC.has(c) ? "text-end" : "text-start"}`}
                  >
                    {t(`columns.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
        <EmptyState
          className="rounded-none border-0"
          icon={<Inbox />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      </div>
    </div>
  );
}
