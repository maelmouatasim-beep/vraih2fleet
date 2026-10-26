import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { withActor } from "@leaseplace/db";
import { Badge } from "@leaseplace/ui/badge";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { TableScroll } from "@leaseplace/ui/table-scroll";
import { SlaBadge, TargetBadge } from "@/components/lessor/lessor-view";
import { PageHeader, StatCard } from "@/components/shell/shells";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { appDb } from "@/lib/db";
import { formatDate, formatMad, formatNumber, ltr } from "@/lib/format";
import { gradesOf, lessorInbox, lessorStats } from "@/lib/lessor/data";
import { actorFor, requireSpace } from "@/lib/viewer";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vue?: string }>;
};

const VIEWS = ["a-traiter", "repondus", "tous"] as const;
type View = (typeof VIEWS)[number];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lessor.inbox" });
  return { title: t("title") };
}

/** Boîte de réception : dossiers transmis, les plus urgents d'abord (délai de 72 h). */
export default async function LessorInbox({ params, searchParams }: Props) {
  const { locale } = await params;
  const { vue } = await searchParams;
  const view: View = (VIEWS as readonly string[]).includes(vue ?? "") ? (vue as View) : "a-traiter";
  const viewer = await requireSpace("lessor", locale as Locale);
  const t = await getTranslations("lessor.inbox");
  const tl = await getTranslations("company.labels");
  const now = new Date();
  const { rows, grades } = await withActor(appDb(), await actorFor(viewer), async (tx) => {
    const rows = await lessorInbox(tx, viewer.membership.organizationId);
    return {
      rows,
      grades: await gradesOf(
        tx,
        rows.map((r) => r.requestId),
      ),
    };
  });
  const stats = lessorStats(rows, now);
  const pending = (s: string) => s === "sent" || s === "viewed";
  const shown = rows
    .filter((r) =>
      view === "a-traiter" ? pending(r.status) : view === "repondus" ? !pending(r.status) : true,
    )
    .sort((a, b) =>
      pending(a.status) && pending(b.status)
        ? (a.slaDueAt?.getTime() ?? 0) - (b.slaDueAt?.getTime() ?? 0)
        : (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0),
    );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description", { organization: viewer.membership.organizationName })}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("kpiPending")}
          value={formatNumber(stats.pending)}
          hint={t("kpiPendingHint")}
        />
        <StatCard
          label={t("kpiOverdue")}
          value={formatNumber(stats.overdue)}
          hint={t("kpiOverdueHint")}
        />
        <StatCard
          label={t("kpiReceived")}
          value={formatNumber(stats.received30d)}
          hint={t("kpiReceivedHint")}
        />
        <StatCard
          label={t("kpiDelay")}
          value={
            stats.averageDelayHours === null
              ? "—"
              : t("hours", { n: formatNumber(stats.averageDelayHours, 1) })
          }
          hint={t("kpiDelayHint")}
        />
      </div>
      <nav aria-label={t("viewsLabel")} className="flex gap-1">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={v === "a-traiter" ? "/bailleur" : { pathname: "/bailleur", query: { vue: v } }}
            aria-current={v === view ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${v === view ? "bg-surface-muted text-fg" : "text-fg-muted hover:text-fg"}`}
          >
            {t(`views.${v}`)}
          </Link>
        ))}
      </nav>
      {shown.length === 0 ? (
        <EmptyState icon={<Inbox />} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <TableScroll label={t("title")}>
            <table className="w-full min-w-[860px] text-[13px]">
              <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">
                    {t("columns.reference")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">
                    {t("columns.company")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">
                    {t("columns.equipment")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-medium">
                    {t("columns.amount")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-medium">
                    {t("columns.duration")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-center font-medium">
                    {t("columns.grade")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end font-medium">
                    {t("columns.received")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">
                    {t("columns.sla")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">
                    {t("columns.status")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((r) => (
                  <tr
                    key={r.targetId}
                    className="hover:bg-surface-muted/50"
                    data-inbox-row={r.reference}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link
                        href={`/bailleur/dossiers/${r.targetId}`}
                        className="tabular font-mono font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {r.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="block font-medium text-fg">{r.companyName}</span>
                      <span className="text-[12px] text-fg-muted">
                        {r.sector ? tl(`sectors.${r.sector}`) : ""}
                        {r.city ? ` · ${r.city}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {r.equipmentCategory ? tl(`equipmentCategories.${r.equipmentCategory}`) : "—"}
                    </td>
                    <td className="tabular px-4 py-2.5 text-end whitespace-nowrap">
                      {r.amountHt ? ltr(formatMad(r.amountHt, 0)) : "—"}
                    </td>
                    <td className="tabular px-4 py-2.5 text-end whitespace-nowrap">
                      {r.durationMonths ? t("months", { n: r.durationMonths }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {grades.get(r.requestId) ? (
                        <Badge tone="primary">{grades.get(r.requestId)}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="tabular px-4 py-2.5 text-end whitespace-nowrap text-fg-muted">
                      {r.sentAt ? formatDate(r.sentAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <SlaBadge dueAt={r.slaDueAt} status={r.status} now={now} />
                    </td>
                    <td className="px-4 py-2.5">
                      <TargetBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      )}
      <p className="text-[12px] text-fg-subtle">{t("disclaimer")}</p>
    </div>
  );
}
