import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@leaseplace/ui/badge";
import { Link } from "@/i18n/navigation";
import type { RequestRow } from "@/lib/company-data";
import { formatDate, formatMad, ltr } from "@/lib/format";

export const STATUS_TONE = {
  draft: "neutral",
  submitted: "info",
  in_review: "primary",
  needs_info: "warning",
  qualified: "success",
  routed: "primary",
  cancelled: "danger",
} as const;

export function statusTone(status: string) {
  return STATUS_TONE[status as keyof typeof STATUS_TONE];
}

/** Liste des demandes de l'entreprise, la plus récente d'abord. */
export async function RequestList({ requests }: { requests: readonly RequestRow[] }) {
  const t = await getTranslations("company.requests");
  const tl = await getTranslations("company.labels");
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      {requests.map((r) => (
        <li key={r.id}>
          <Link
            href={`/entreprise/demandes/${r.id}`}
            className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-muted/60"
            data-request={r.reference}
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="tabular font-mono text-[12px] whitespace-nowrap text-fg-subtle">
                  {r.reference}
                </span>
                <Badge tone={statusTone(r.status)}>{t(`statuses.${r.status}`)}</Badge>
              </p>
              <p className="mt-1 truncate text-[14px] font-medium text-fg">
                {r.equipmentCategory
                  ? tl(`equipmentCategories.${r.equipmentCategory}`)
                  : t("untitled")}
                {r.equipmentDescription ? (
                  <span className="font-normal text-fg-muted"> — {r.equipmentDescription}</span>
                ) : null}
              </p>
            </div>
            <div className="hidden text-end sm:block">
              <p className="tabular text-[14px] font-medium text-fg">
                {r.amountHt ? ltr(formatMad(r.amountHt, 0)) : "—"}
              </p>
              <p className="tabular text-[12px] text-fg-subtle">
                {t(r.submittedAt ? "submittedOn" : "updatedOn", {
                  date: formatDate(r.submittedAt ?? r.updatedAt),
                })}
              </p>
            </div>
            <ChevronRight
              className="size-4 shrink-0 text-fg-subtle rtl:rotate-180"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
