import { getTranslations } from "next-intl/server";
import type { DealStatus } from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";
import type { DealView } from "@/lib/deals/data";
import { formatDate, formatMad, ltr } from "@/lib/format";

export const DEAL_TONE: Record<DealStatus, "info" | "primary" | "success" | "neutral" | "danger"> =
  {
    accepted: "info",
    signed: "primary",
    delivered: "primary",
    active: "success",
    cancelled: "danger",
  };

/** Opération : statut, étapes datées, motif d'annulation. Commun aux deux espaces. */
export async function DealSummary({ view }: { view: DealView }) {
  const t = await getTranslations("deals");
  const { deal } = view;
  const status = deal.status as DealStatus;
  const steps: readonly (readonly [string, Date | null])[] = [
    [t("steps.accepted"), deal.acceptedAt],
    [t("steps.signed"), deal.signedOn],
    [t("steps.delivered"), deal.deliveredOn],
    [t("steps.active"), deal.activatedOn],
  ];
  return (
    <div className="flex flex-col gap-4" data-deal={status}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={DEAL_TONE[status]}>{t(`statuses.${status}`)}</Badge>
        <span className="text-[13px] text-fg-muted">
          {t("financed", { amount: ltr(formatMad(deal.financedAmountHt, 0)) })}
        </span>
      </div>
      <ol className="grid gap-2 text-[13px] sm:grid-cols-4">
        {steps.map(([label, date]) => (
          <li key={label} className="rounded-md border border-border px-3 py-2">
            <p className="text-fg-muted">{label}</p>
            <p className="tabular font-medium text-fg">{date ? formatDate(date) : "—"}</p>
          </li>
        ))}
      </ol>
      {status === "cancelled" && deal.cancelReason ? (
        <p className="text-[13px] text-fg">
          {t("cancelledBy", {
            side: t(`sides.${deal.cancelSide ?? "lessor"}`),
            date: deal.cancelledAt ? formatDate(deal.cancelledAt) : "—",
            reason: t(`reasons.${deal.cancelReason}`),
          })}
        </p>
      ) : null}
    </div>
  );
}
