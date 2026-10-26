import { getTranslations } from "next-intl/server";
import type { CommissionGrid } from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";
import { formatMad, formatPercent, ltr } from "@/lib/format";

export const MANDATE_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  active: "success",
  suspended: "warning",
  terminated: "danger",
};
export const COMMISSION_TONE: Record<
  string,
  "info" | "primary" | "success" | "neutral" | "danger"
> = {
  due: "info",
  invoiced: "primary",
  paid: "success",
  cancelled: "neutral",
  overdue: "danger",
};

export async function MandateBadge({ status }: { status: string }) {
  const t = await getTranslations("billing.mandate.statuses");
  return <Badge tone={MANDATE_TONE[status] ?? "neutral"}>{t(status)}</Badge>;
}

export async function CommissionBadge({ status, overdue }: { status: string; overdue: boolean }) {
  const t = await getTranslations("billing.commission.statuses");
  const key = overdue ? "overdue" : status;
  return (
    <Badge tone={COMMISSION_TONE[key] ?? "neutral"} data-commission-status={key}>
      {t(key)}
    </Badge>
  );
}

/** Grille marginale : une ligne par tranche. */
export async function GridTable({ grid }: { grid: CommissionGrid }) {
  const t = await getTranslations("billing.grid");
  return (
    <table className="w-full text-[13px]" data-grid>
      <caption className="sr-only">{t("caption")}</caption>
      <thead className="text-fg-muted">
        <tr>
          <th scope="col" className="py-1 text-start font-medium">
            {t("tier")}
          </th>
          <th scope="col" className="py-1 text-end font-medium">
            {t("rate")}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {grid.map((tier, i) => {
          const to = grid[i + 1]?.from;
          return (
            <tr key={tier.from}>
              <td className="tabular py-1.5 text-fg">
                {to === undefined
                  ? t("above", { from: ltr(formatMad(tier.from, 0)) })
                  : t("range", { from: ltr(formatMad(tier.from, 0)), to: ltr(formatMad(to, 0)) })}
              </td>
              <td className="tabular py-1.5 text-end font-medium">
                {ltr(formatPercent(tier.rate, 2))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
