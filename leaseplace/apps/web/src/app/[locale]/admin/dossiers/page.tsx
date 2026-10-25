import { ClipboardCheck, Lock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { withActor } from "@leaseplace/db";
import { can } from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { TableScroll } from "@leaseplace/ui/table-scroll";
import { StatusBadge } from "@/components/review/review-view";
import { PageHeader } from "@/components/shell/shells";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { appDb } from "@/lib/db";
import { formatDate, formatMad, ltr } from "@/lib/format";
import { reviewQueue } from "@/lib/review/data";
import { actorFor, requireSpace } from "@/lib/viewer";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "review" });
  return { title: t("queue.title") };
}

/** File de revue : demandes soumises, en revue, en attente de compléments, qualifiées. */
export default async function ReviewQueue({ params }: Props) {
  const { locale } = await params;
  const viewer = await requireSpace("admin", locale as Locale);
  const t = await getTranslations("review");
  const tl = await getTranslations("company.labels");
  if (!can(viewer.membership.role, "kyc.review")) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t("queue.title")} />
        <EmptyState
          icon={<Lock />}
          title={t("restrictedTitle")}
          description={t("restrictedBody")}
        />
      </div>
    );
  }
  const rows = await withActor(appDb(), await actorFor(viewer), (tx) => reviewQueue(tx));
  const waiting = rows.filter((r) => r.status === "submitted").length;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title={t("queue.title")}
        description={t("queue.description", { count: waiting })}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck />}
          title={t("queue.emptyTitle")}
          description={t("queue.emptyBody")}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <TableScroll label={t("queue.title")}>
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">
                    {t("queue.columns.reference")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">
                    {t("queue.columns.company")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">
                    {t("queue.columns.equipment")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-medium">
                    {t("queue.columns.amount")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-medium">
                    {t("queue.columns.submitted")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">
                    {t("queue.columns.status")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-center font-medium">
                    {t("queue.columns.grade")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-muted/50" data-queue-row={r.reference}>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link
                        href={`/admin/dossiers/${r.id}`}
                        className="tabular font-mono font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {r.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-fg">{r.companyName}</td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {r.equipmentCategory ? tl(`equipmentCategories.${r.equipmentCategory}`) : "—"}
                    </td>
                    <td className="tabular px-4 py-2.5 text-end whitespace-nowrap">
                      {r.amountHt ? ltr(formatMad(r.amountHt, 0)) : "—"}
                    </td>
                    <td className="tabular px-4 py-2.5 text-end whitespace-nowrap text-fg-muted">
                      {r.submittedAt ? formatDate(r.submittedAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {r.grade ? (
                        <Badge tone="primary">{r.grade}</Badge>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      )}
    </div>
  );
}
