import { BadgePercent, Download } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { withActor } from "@leaseplace/db";
import { can, isInvoiceOverdue } from "@leaseplace/domain";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { TableScroll } from "@leaseplace/ui/table-scroll";
import { CommissionActions } from "@/components/billing/commission-actions";
import { CommissionBadge } from "@/components/billing/views";
import { PageHeader, StatCard } from "@/components/shell/shells";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { listCommissions } from "@/lib/billing/data";
import { appDb } from "@/lib/db";
import { formatDate, formatMad, ltr } from "@/lib/format";
import { isoDay } from "@/lib/format";
import { actorFor, requireSpace } from "@/lib/viewer";
import { cancelCommissionAction, issueInvoiceAction, markPaidAction } from "../billing-actions";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ vue?: string }> };
const VIEWS = ["a-facturer", "facturees", "payees", "toutes"] as const;
type View = (typeof VIEWS)[number];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing.commissions" });
  return { title: t("title"), robots: { index: false } };
}

/** Commissions dues à la mise en loyer : facturation, encaissement, avoirs. */
export default async function AdminCommissions({ params, searchParams }: Props) {
  const { locale } = await params;
  const { vue } = await searchParams;
  const view: View = (VIEWS as readonly string[]).includes(vue ?? "")
    ? (vue as View)
    : "a-facturer";
  const viewer = await requireSpace("admin", locale as Locale);
  const t = await getTranslations("billing.commissions");
  if (!can(viewer.membership.role, "commission.manage") && !can(viewer.membership.role, "kpi.read"))
    return (
      <EmptyState
        icon={<BadgePercent />}
        title={t("restrictedTitle")}
        description={t("restrictedBody")}
      />
    );
  const manage = can(viewer.membership.role, "commission.manage");
  const rows = await withActor(appDb(), await actorFor(viewer), (tx) => listCommissions(tx));
  const today = new Date(`${isoDay()}T00:00:00Z`);
  const overdue = (r: (typeof rows)[number]) =>
    isInvoiceOverdue(r.status, r.invoice?.dueOn ?? null, today);
  const sum = (list: typeof rows) =>
    ltr(
      formatMad(
        list.reduce((s, r) => s + r.amountHt, 0),
        0,
      ),
    );
  const shown = rows.filter((r) =>
    view === "a-facturer"
      ? r.status === "due"
      : view === "facturees"
        ? r.status === "invoiced"
        : view === "payees"
          ? r.status === "paid"
          : true,
  );
  const year = isoDay().slice(0, 4);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("kpiDue")}
          value={sum(rows.filter((r) => r.status === "due"))}
          hint={t("ht")}
        />
        <StatCard
          label={t("kpiInvoiced")}
          value={sum(rows.filter((r) => r.status === "invoiced"))}
          hint={t("ht")}
        />
        <StatCard
          label={t("kpiOverdue")}
          value={sum(rows.filter(overdue))}
          hint={t("kpiOverdueHint")}
        />
        <StatCard
          label={t("kpiPaid", { year })}
          value={sum(
            rows.filter((r) => r.status === "paid" && r.paidOn?.toISOString().startsWith(year)),
          )}
          hint={t("ht")}
        />
      </div>
      <nav aria-label={t("viewsLabel")} className="flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={
              v === "a-facturer"
                ? "/admin/commissions"
                : { pathname: "/admin/commissions", query: { vue: v } }
            }
            aria-current={v === view ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${v === view ? "bg-surface-muted text-fg" : "text-fg-muted hover:text-fg"}`}
          >
            {t(`views.${v}`)}
          </Link>
        ))}
      </nav>
      {shown.length === 0 ? (
        <EmptyState icon={<BadgePercent />} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <TableScroll label={t("title")}>
            <table className="w-full min-w-[980px] text-[13px]">
              <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
                <tr>
                  {(
                    [
                      "reference",
                      "lessor",
                      "activated",
                      "financed",
                      "commission",
                      "status",
                      "invoice",
                      "actions",
                    ] as const
                  ).map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className={`px-3 py-2.5 font-medium ${["financed", "commission", "actions"].includes(c) ? "text-end" : "text-start"}`}
                    >
                      {t(`columns.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((r) => (
                  <tr key={r.id} data-commission-row={r.reference}>
                    <td className="tabular px-3 py-2.5 font-mono whitespace-nowrap">
                      {r.reference}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-fg">{r.lessorName}</td>
                    <td className="tabular px-3 py-2.5">{formatDate(r.activatedOn)}</td>
                    <td className="tabular px-3 py-2.5 text-end">
                      {ltr(formatMad(r.financedAmountHt, 0))}
                    </td>
                    <td className="tabular px-3 py-2.5 text-end">
                      <span className="block font-semibold">{ltr(formatMad(r.amountHt, 2))}</span>
                      <span className="text-[11px] text-fg-subtle">
                        {t("ttc", { amount: ltr(formatMad(r.amountTtc, 2)) })}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <CommissionBadge status={r.status} overdue={overdue(r)} />
                    </td>
                    <td className="px-3 py-2.5">
                      {r.invoice ? (
                        <a
                          href={`/api/factures/${r.invoice.id}`}
                          className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
                          data-invoice={r.invoice.number}
                        >
                          <Download className="size-3.5" aria-hidden="true" />
                          {r.invoice.number}
                        </a>
                      ) : (
                        "—"
                      )}
                      {r.invoice ? (
                        <span className="block text-[11px] text-fg-subtle">
                          {t("dueOn", { date: formatDate(r.invoice.dueOn) })}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-end">
                      {manage ? (
                        <CommissionActions
                          id={r.id}
                          status={r.status}
                          today={isoDay()}
                          actions={{
                            invoice: issueInvoiceAction,
                            pay: markPaidAction,
                            cancel: cancelCommissionAction,
                          }}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      )}
      <p className="text-[12px] text-fg-subtle">{t("legal")}</p>
    </div>
  );
}
