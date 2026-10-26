import { Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { slaState } from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";

const TONE: Record<string, "info" | "primary" | "success" | "neutral"> = {
  sent: "info",
  viewed: "primary",
  offered: "success",
  declined: "neutral",
};

export async function TargetBadge({ status }: { status: string }) {
  const t = await getTranslations("lessor.statuses");
  return <Badge tone={TONE[status] ?? "neutral"}>{t(status)}</Badge>;
}

/** Délai de réponse restant (72 h) ; en retard en rouge ; rien une fois répondu. */
export async function SlaBadge({
  dueAt,
  status,
  now,
}: {
  dueAt: Date | null;
  status: string;
  now: Date;
}) {
  const t = await getTranslations("lessor.sla");
  if (!dueAt || (status !== "sent" && status !== "viewed"))
    return <span className="text-fg-subtle">—</span>;
  const s = slaState(dueAt, now);
  return (
    <Badge
      tone={s.overdue ? "danger" : s.hoursLeft < 24 ? "warning" : "neutral"}
      data-sla={s.overdue ? "overdue" : "ok"}
    >
      <Clock className="size-3" aria-hidden="true" />
      {s.overdue
        ? -s.hoursLeft >= 48
          ? t("overdueDays", { days: Math.floor(-s.hoursLeft / 24) })
          : t("overdue", { hours: -s.hoursLeft })
        : t("left", { hours: s.hoursLeft })}
    </Badge>
  );
}
