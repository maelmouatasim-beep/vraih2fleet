import { getTranslations } from "next-intl/server";
import {
  funnel,
  mean,
  medianHoursToFirstOffer,
  offersPerRoutedRequest,
  savingsOf,
} from "@leaseplace/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@leaseplace/ui/card";
import { StatCard } from "@/components/shell/shells";
import type { KpiData } from "@/lib/billing/data";
import { formatMad, formatNumber, formatPercent, ltr } from "@/lib/format";

/** Tableau de bord interne : entonnoir, réactivité, valeur créée, production, commissions. */
export async function KpiDashboard({ data }: { data: KpiData }) {
  const t = await getTranslations("kpis");
  const steps = funnel(data.funnel);
  const max = Math.max(1, ...steps.map((s) => s.count));
  const hours = medianHoursToFirstOffer(data.funnel);
  const perFile = offersPerRoutedRequest(data.offersPerRequest);
  const saving = mean(
    data.savings.flatMap((s) => {
      const v = savingsOf(s.offerCosts, s.acceptedCost);
      return v === null ? [] : [v];
    }),
  );
  const commission = (statuses: string[]) =>
    ltr(
      formatMad(
        data.commissions
          .filter((c) => statuses.includes(c.status))
          .reduce((s, c) => s + c.amountHt, 0),
        0,
      ),
    );
  return (
    <section className="flex flex-col gap-4" aria-labelledby="kpi-title" data-kpis>
      <h2 id="kpi-title" className="text-lg font-semibold text-fg">
        {t("title")}
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("timeToOffer")}
          value={hours === null ? "—" : t("hours", { n: formatNumber(hours, 1) })}
          hint={t("timeToOfferHint")}
        />
        <StatCard
          label={t("offersPerFile")}
          value={perFile === null ? "—" : formatNumber(perFile, 1)}
          hint={t("offersPerFileHint")}
        />
        <StatCard
          label={t("savings")}
          value={saving === null ? "—" : ltr(formatMad(saving, 0))}
          hint={t("savingsHint")}
        />
        <StatCard
          label={t("production")}
          value={ltr(formatMad(data.productionHt, 0))}
          hint={t("productionHint", { count: data.activeDeals })}
        />
        <StatCard
          label={t("commissionsDue")}
          value={commission(["due", "invoiced"])}
          hint={t("ht")}
        />
        <StatCard label={t("commissionsPaid")} value={commission(["paid"])} hint={t("ht")} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("funnelTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-2.5" data-funnel>
            {steps.map((s) => (
              <li
                key={s.stage}
                className="grid grid-cols-[10rem_1fr_6rem] items-center gap-3 text-[13px]"
                data-stage={s.stage}
              >
                <span className="text-fg">{t(`stages.${s.stage}`)}</span>
                <span
                  className="h-2.5 overflow-hidden rounded-full bg-surface-sunken"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${String((s.count / max) * 100)}%` }}
                  />
                </span>
                <span className="tabular text-end text-fg">
                  <span className="font-semibold">{formatNumber(s.count)}</span>
                  {s.fromPrevious === null ? null : (
                    <span className="ms-1.5 text-fg-subtle">
                      {ltr(formatPercent(s.fromPrevious, 0))}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[12px] text-fg-subtle">{t("funnelNote")}</p>
        </CardContent>
      </Card>
    </section>
  );
}
