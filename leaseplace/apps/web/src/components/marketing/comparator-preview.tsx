import { Trophy } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { normalizeOffer, priceLease, rankOffers, type OfferTerms } from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";
import { cn } from "@leaseplace/ui/cn";
import { formatMad, formatPercent, ltr } from "@/lib/format";

/**
 * Aperçu du comparateur avec trois offres FICTIVES (affichées comme telles),
 * calculées et classées par le vrai moteur.
 */
const EXAMPLE = {
  financedAmountHt: 1_200_000,
  durationMonths: 60,
  firstRentHt: 120_000,
  residualValueHt: 12_000,
} as const;
const FICTIVE = [
  { id: "A", annualRate: 0.084, fileFeesHt: 2_500 },
  { id: "B", annualRate: 0.079, fileFeesHt: 6_000 },
  { id: "C", annualRate: 0.081, fileFeesHt: 0 },
] as const;

function offers() {
  return FICTIVE.map((f) => {
    const pricing = priceLease({
      ...EXAMPLE,
      periodicity: "monthly",
      timing: "advance",
      annualRate: f.annualRate,
    });
    const terms: OfferTerms = {
      ...EXAMPLE,
      periodicity: "monthly",
      timing: "advance",
      firstRentHt: pricing.firstRentHt,
      rentHt: pricing.rentHt,
      fileFeesHt: f.fileFeesHt,
      insurancePerPeriodHt: 0,
      insuranceRequired: false,
      vatRate: 0.2,
    };
    return { id: f.id, terms, normalized: normalizeOffer(terms) };
  });
}

export async function ComparatorPreview() {
  const t = await getTranslations("landing.preview");
  const ranked = rankOffers(offers());
  return (
    <div className="flex flex-col gap-3" aria-label={t("illustrative")}>
      {ranked.map((o, i) => (
        <div
          key={o.id}
          className={cn(
            "grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-lg border bg-surface p-4 shadow-sm",
            i === 0 ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
          )}
        >
          <span className="tabular flex size-8 items-center justify-center rounded-md bg-surface-sunken font-mono text-[12px] text-fg-muted">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-fg">
              {t("lessor", { letter: o.id })}
              {i === 0 ? (
                <Badge tone="success">
                  <Trophy aria-hidden="true" />
                  {t("best")}
                </Badge>
              ) : null}
            </p>
            <p className="tabular mt-0.5 text-[12px] text-fg-muted">
              {t("line", {
                rent: ltr(formatMad(o.terms.rentHt, 0)),
                rate: ltr(formatPercent(o.normalized.rates.annualEffectiveRate)),
              })}
            </p>
          </div>
          <div className="text-end">
            <p className="text-[11px] text-fg-subtle">{t("totalCost")}</p>
            <p className="tabular text-[15px] font-semibold text-fg">
              {ltr(formatMad(o.normalized.totals.financingCostHt, 0))}
            </p>
          </div>
        </div>
      ))}
      <p className="text-[12px] text-fg-subtle">{t("illustrative")}</p>
    </div>
  );
}
