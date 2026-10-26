import { KanbanSquare } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { withActor } from "@leaseplace/db";
import { nextDealStep } from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { TableScroll } from "@leaseplace/ui/table-scroll";
import { DEAL_TONE } from "@/components/deals/deal-card";
import { PageHeader, StatCard } from "@/components/shell/shells";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { appDb } from "@/lib/db";
import { lessorPipeline } from "@/lib/deals/data";
import { formatDate, formatMad, formatNumber, ltr } from "@/lib/format";
import { actorFor, requireSpace } from "@/lib/viewer";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vue?: string }>;
};

const VIEWS = ["en-cours", "mis-en-loyer", "annules"] as const;
type View = (typeof VIEWS)[number];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lessor.pipeline" });
  return { title: t("title"), robots: { index: false } };
}

/** Pipeline : opérations nées d'une offre acceptée, jusqu'à la mise en loyer. */
export default async function Pipeline({ params, searchParams }: Props) {
  const { locale } = await params;
  const { vue } = await searchParams;
  const viewer = await requireSpace("lessor", locale as Locale);
  const view: View = (VIEWS as readonly string[]).includes(vue ?? "") ? (vue as View) : "en-cours";
  const rows = await withActor(appDb(), await actorFor(viewer), (tx) =>
    lessorPipeline(tx, viewer.membership.organizationId),
  );
  const t = await getTranslations("lessor.pipeline");
  const td = await getTranslations("deals");
  const inView = (status: string) =>
    view === "en-cours"
      ? ["accepted", "signed", "delivered"].includes(status)
      : view === "mis-en-loyer"
        ? status === "active"
        : status === "cancelled";
  const shown = rows.filter((r) => inView(r.status));
  const ongoing = rows.filter((r) => ["accepted", "signed", "delivered"].includes(r.status));
  const active = rows.filter((r) => r.status === "active");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("kpiOngoing")} value={formatNumber(ongoing.length)} />
        <StatCard
          label={t("kpiOngoingAmount")}
          value={ltr(
            formatMad(
              ongoing.reduce((s, r) => s + r.financedAmountHt, 0),
              0,
            ),
          )}
        />
        <StatCard label={t("kpiActive")} value={formatNumber(active.length)} />
        <StatCard
          label={t("kpiActiveAmount")}
          value={ltr(
            formatMad(
              active.reduce((s, r) => s + r.financedAmountHt, 0),
              0,
            ),
          )}
        />
      </div>
      <nav aria-label={t("viewsLabel")} className="flex gap-1">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={
              v === "en-cours"
                ? "/bailleur/pipeline"
                : { pathname: "/bailleur/pipeline", query: { vue: v } }
            }
            aria-current={v === view ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${v === view ? "bg-surface-muted text-fg" : "text-fg-muted hover:text-fg"}`}
          >
            {t(`views.${v}`)}
          </Link>
        ))}
      </nav>
      {shown.length === 0 ? (
        <EmptyState icon={<KanbanSquare />} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <TableScroll label={t("title")}>
            <table className="w-full min-w-[820px] text-[13px]">
              <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
                <tr>
                  {(["reference", "company", "amount", "accepted", "status", "next"] as const).map(
                    (c) => (
                      <th
                        key={c}
                        scope="col"
                        className={`px-4 py-2.5 font-medium ${c === "amount" || c === "accepted" ? "text-end" : "text-start"}`}
                      >
                        {t(`columns.${c}`)}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((r) => {
                  const step = nextDealStep(r.status);
                  return (
                    <tr key={r.dealId} data-pipeline-row={r.reference}>
                      <td className="px-4 py-2.5">
                        {r.targetId ? (
                          <Link
                            href={`/bailleur/dossiers/${r.targetId}`}
                            className="tabular font-mono font-medium text-primary hover:underline"
                          >
                            {r.reference}
                          </Link>
                        ) : (
                          <span className="tabular font-mono">{r.reference}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-fg">{r.companyName}</td>
                      <td className="tabular px-4 py-2.5 text-end">
                        {ltr(formatMad(r.financedAmountHt, 0))}
                      </td>
                      <td className="tabular px-4 py-2.5 text-end">{formatDate(r.acceptedAt)}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={DEAL_TONE[r.status]}>{td(`statuses.${r.status}`)}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-fg-muted">
                        {step ? td(`next.${step}`) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </div>
      )}
    </div>
  );
}
