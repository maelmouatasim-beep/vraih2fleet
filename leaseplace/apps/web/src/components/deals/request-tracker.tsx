import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requestTracker, type DealStatus } from "@leaseplace/domain";
import { cn } from "@leaseplace/ui/cn";

/** Suivi « type colis » : du dépôt de la demande à la mise en loyer. */
export async function RequestTracker({
  requestStatus,
  offerCount,
  dealStatus,
}: {
  requestStatus: string;
  offerCount: number;
  dealStatus: DealStatus | null;
}) {
  const t = await getTranslations("company.tracker");
  const steps = requestTracker({ requestStatus, offerCount, dealStatus });
  if (steps.length === 0) return null;
  const current = steps.find((s) => s.state === "current");
  return (
    <nav aria-label={t("label")} data-tracker={current?.step ?? "done"}>
      <ol className="flex flex-col gap-2 sm:grid sm:grid-cols-8 sm:gap-1">
        {steps.map((s, i) => (
          <li
            key={s.step}
            className="flex items-center gap-2 sm:flex-col sm:items-stretch sm:gap-1.5"
            aria-current={s.state === "current" ? "step" : undefined}
            data-step={s.step}
            data-state={s.state}
          >
            <span className="flex items-center sm:w-full">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  s.state === "done" && "border-primary bg-primary text-primary-fg",
                  s.state === "current" && "border-primary bg-primary-soft text-primary-soft-fg",
                  s.state === "upcoming" && "border-border bg-surface text-fg-subtle",
                )}
                aria-hidden="true"
              >
                {s.state === "done" ? <Check className="size-3.5" /> : i + 1}
              </span>
              {i < steps.length - 1 ? (
                <span
                  className={cn(
                    "ms-1 hidden h-0.5 flex-1 rounded-full sm:block",
                    s.state === "done" ? "bg-primary" : "bg-border",
                  )}
                  aria-hidden="true"
                />
              ) : null}
            </span>
            <span
              className={cn(
                "text-[12px] leading-tight",
                s.state === "upcoming" ? "text-fg-subtle" : "font-medium text-fg",
              )}
            >
              {t(`steps.${s.step}`)}
              <span className="sr-only"> — {t(`states.${s.state}`)}</span>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
