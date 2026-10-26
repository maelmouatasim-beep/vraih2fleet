import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { withActor } from "@leaseplace/db";
import { can } from "@leaseplace/domain";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { TableScroll } from "@leaseplace/ui/table-scroll";
import { MandateBadge } from "@/components/billing/views";
import { PageHeader } from "@/components/shell/shells";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { lessorsOverview } from "@/lib/billing/data";
import { appDb } from "@/lib/db";
import { formatDate, formatMad, formatNumber, ltr } from "@/lib/format";
import { actorFor, requireSpace } from "@/lib/viewer";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing.lessors" });
  return { title: t("title"), robots: { index: false } };
}

/** Bailleurs partenaires : mandat en vigueur, appétit, volumes. */
export default async function AdminLessors({ params }: Props) {
  const { locale } = await params;
  const viewer = await requireSpace("admin", locale as Locale);
  const t = await getTranslations("billing.lessors");
  const rows = await withActor(appDb(), await actorFor(viewer), (tx) => lessorsOverview(tx));
  const columns = [
    "name",
    "mandate",
    "appetite",
    "received",
    "offers",
    "active",
    "production",
  ] as const;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader title={t("title")} description={t("description")} />
      {rows.length === 0 ? (
        <EmptyState icon={<Building2 />} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <TableScroll label={t("title")}>
            <table className="w-full min-w-[860px] text-[13px]">
              <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className={`px-4 py-2.5 font-medium ${["received", "offers", "active", "production"].includes(c) ? "text-end" : "text-start"}`}
                    >
                      {t(`columns.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} data-lessor-row={r.name}>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/bailleurs/${r.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.mandate ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <MandateBadge status={r.mandate.status} />
                          <span className="text-fg-muted">
                            {r.mandate.contractVersion || "—"}
                            {r.mandate.signedOn ? ` · ${formatDate(r.mandate.signedOn)}` : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="text-danger">{t("noMandate")}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {r.appetiteActive === null
                        ? "—"
                        : r.appetiteActive
                          ? t("appetiteOpen")
                          : t("appetiteClosed")}
                    </td>
                    <td className="tabular px-4 py-2.5 text-end">{formatNumber(r.received)}</td>
                    <td className="tabular px-4 py-2.5 text-end">{formatNumber(r.offers)}</td>
                    <td className="tabular px-4 py-2.5 text-end">{formatNumber(r.activeDeals)}</td>
                    <td className="tabular px-4 py-2.5 text-end">
                      {ltr(formatMad(r.productionHt, 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      )}
      {!can(viewer.membership.role, "mandate.manage") ? (
        <p className="text-[13px] text-fg-muted">{t("readOnly")}</p>
      ) : null}
    </div>
  );
}
