import { Download, Receipt } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { withActor } from "@leaseplace/db";
import { can, isInvoiceOverdue } from "@leaseplace/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@leaseplace/ui/card";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { TableScroll } from "@leaseplace/ui/table-scroll";
import { CommissionBadge, GridTable, MandateBadge } from "@/components/billing/views";
import { PageHeader, StatCard } from "@/components/shell/shells";
import type { Locale } from "@/i18n/routing";
import { activeMandateOf, gridOf, listCommissions } from "@/lib/billing/data";
import { appDb } from "@/lib/db";
import { formatDate, formatMad, isoDay, ltr } from "@/lib/format";
import { actorFor, requireSpace } from "@/lib/viewer";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing.lessorBilling" });
  return { title: t("title"), robots: { index: false } };
}

/** Facturation du bailleur : mandat en vigueur, commissions, factures. */
export default async function LessorBilling({ params }: Props) {
  const { locale } = await params;
  const viewer = await requireSpace("lessor", locale as Locale);
  const t = await getTranslations("billing.lessorBilling");
  const tc = await getTranslations("billing.commissions");
  const orgId = viewer.membership.organizationId;
  const allowed = can(viewer.membership.role, "billing.read_own");
  const { mandate, rows } = await withActor(appDb(), await actorFor(viewer), async (tx) => ({
    mandate: await activeMandateOf(tx, orgId),
    rows: allowed ? await listCommissions(tx, orgId) : [],
  }));
  const today = new Date(`${isoDay()}T00:00:00Z`);
  const overdue = (r: (typeof rows)[number]) =>
    isInvoiceOverdue(r.status, r.invoice?.dueOn ?? null, today);
  const sum = (list: typeof rows) =>
    ltr(
      formatMad(
        list.reduce((s, r) => s + r.amountTtc, 0),
        2,
      ),
    );
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <PageHeader title={t("title")} description={t("description")} />
      <Card data-lessor-mandate>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {t("mandateTitle")}
            {mandate ? <MandateBadge status={mandate.status} /> : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mandate ? (
            <div className="grid gap-5 md:grid-cols-2">
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <dt className="text-fg-muted">{t("version")}</dt>
                  <dd className="font-medium text-fg">{mandate.contractVersion}</dd>
                </div>
                <div>
                  <dt className="text-fg-muted">{t("signedOn")}</dt>
                  <dd className="tabular font-medium text-fg">
                    {mandate.signedOn ? formatDate(mandate.signedOn) : "—"}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-fg-muted">{t("antiCircumvention")}</dt>
                  <dd className="text-fg">
                    {t("antiCircumventionBody", { months: mandate.antiCircumventionMonths })}
                  </dd>
                </div>
              </dl>
              <GridTable grid={gridOf(mandate)} />
            </div>
          ) : (
            <p className="text-[14px] text-fg-muted">{t("noMandate")}</p>
          )}
        </CardContent>
      </Card>
      {!allowed ? (
        <EmptyState
          icon={<Receipt />}
          title={t("restrictedTitle")}
          description={t("restrictedBody")}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard
              label={t("kpiDue")}
              value={sum(rows.filter((r) => r.status === "due" || r.status === "invoiced"))}
              hint={t("ttc")}
            />
            <StatCard label={t("kpiOverdue")} value={sum(rows.filter(overdue))} hint={t("ttc")} />
            <StatCard
              label={t("kpiPaid")}
              value={sum(rows.filter((r) => r.status === "paid"))}
              hint={t("ttc")}
            />
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={<Receipt />} title={t("emptyTitle")} description={t("emptyBody")} />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
              <TableScroll label={t("title")}>
                <table className="w-full min-w-[820px] text-[13px]">
                  <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
                    <tr>
                      {(
                        [
                          "reference",
                          "activated",
                          "financed",
                          "commission",
                          "status",
                          "invoice",
                        ] as const
                      ).map((c) => (
                        <th
                          key={c}
                          scope="col"
                          className={`px-4 py-2.5 font-medium ${["financed", "commission"].includes(c) ? "text-end" : "text-start"}`}
                        >
                          {tc(`columns.${c}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr key={r.id} data-commission-row={r.reference}>
                        <td className="tabular px-4 py-2.5 font-mono">{r.reference}</td>
                        <td className="tabular px-4 py-2.5">{formatDate(r.activatedOn)}</td>
                        <td className="tabular px-4 py-2.5 text-end">
                          {ltr(formatMad(r.financedAmountHt, 0))}
                        </td>
                        <td className="tabular px-4 py-2.5 text-end">
                          <span className="block font-semibold">
                            {ltr(formatMad(r.amountHt, 2))}
                          </span>
                          <span className="text-[11px] text-fg-subtle">
                            {tc("ttc", { amount: ltr(formatMad(r.amountTtc, 2)) })}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <CommissionBadge status={r.status} overdue={overdue(r)} />
                        </td>
                        <td className="px-4 py-2.5">
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
                            <span className="text-fg-subtle">{t("notInvoiced")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </div>
          )}
        </>
      )}
      <p className="text-[12px] text-fg-subtle">{t("legal")}</p>
    </div>
  );
}
