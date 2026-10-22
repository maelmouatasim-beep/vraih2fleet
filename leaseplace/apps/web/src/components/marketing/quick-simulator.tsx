"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@leaseplace/ui/button";
import { Slider } from "@leaseplace/ui/slider";
import { Link } from "@/i18n/navigation";
import { formatMad, formatPercent, ltr } from "@/lib/format";
import { DEFAULTS, LIMITS, simulate, toSearchParams, type SimulatorParams } from "@/lib/simulator";

/** Simulateur réduit de la page d'accueil : 3 réglages, le reste au simulateur complet. */
export function QuickSimulator({ preset = {} }: { preset?: Partial<SimulatorParams> }) {
  const t = useTranslations("landing.quick");
  const [p, setP] = useState<SimulatorParams>({ ...DEFAULTS, ...preset });
  const result = useMemo(() => simulate(p), [p]);
  const set = <K extends keyof SimulatorParams>(k: K, v: SimulatorParams[K]) => {
    setP((prev) => ({ ...prev, [k]: v }));
  };
  const query = Object.fromEntries(toSearchParams(p));

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-lg md:p-6">
      <p className="text-[13px] font-semibold text-fg">{t("title")}</p>
      <div className="mt-5 flex flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-fg-muted">{t("amount")}</span>
            <span className="tabular font-medium text-fg">{ltr(formatMad(p.amount, 0))}</span>
          </div>
          <Slider
            label={t("amount")}
            valueText={formatMad(p.amount, 0)}
            min={LIMITS.amount.min}
            max={5_000_000}
            step={10_000}
            value={Math.min(p.amount, 5_000_000)}
            onValueChange={(v) => {
              set("amount", v);
            }}
          />
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-fg-muted">{t("duration")}</span>
            <span className="tabular font-medium text-fg">{t("months", { n: p.months })}</span>
          </div>
          <Slider
            label={t("duration")}
            valueText={t("months", { n: p.months })}
            min={LIMITS.months.min}
            max={LIMITS.months.max}
            step={LIMITS.months.step}
            value={p.months}
            onValueChange={(v) => {
              set("months", v);
            }}
          />
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-fg-muted">{t("firstRent")}</span>
            <span className="tabular font-medium text-fg">
              {ltr(formatPercent(p.firstRentPct / 100, 0))}
            </span>
          </div>
          <Slider
            label={t("firstRent")}
            valueText={formatPercent(p.firstRentPct / 100, 0)}
            min={0}
            max={LIMITS.firstRentPct.max}
            step={1}
            value={p.firstRentPct}
            onValueChange={(v) => {
              set("firstRentPct", v);
            }}
          />
        </div>
      </div>
      <div className="mt-6 rounded-lg bg-primary-soft/50 px-4 py-4" aria-live="polite">
        {result.ok ? (
          <>
            <p className="text-[12px] text-fg-muted">{t("rentLabel")}</p>
            <p
              className="tabular mt-1 text-[30px] leading-none font-semibold tracking-tight text-fg"
              data-testid="loyer-rapide"
            >
              {ltr(formatMad(result.pricing.rentHt, 0))}
            </p>
            <p className="tabular mt-2 text-[12px] text-fg-muted">
              {t("teg", {
                rate: ltr(formatPercent(result.offer.rates.annualEffectiveRate)),
                base: ltr(formatPercent(p.ratePct / 100)),
              })}
            </p>
          </>
        ) : null}
      </div>
      <Button asChild variant="secondary" className="mt-4 w-full">
        <Link href={{ pathname: "/simulateur", query }}>
          {t("details")}
          <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
        </Link>
      </Button>
      <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">{t("hint")}</p>
    </div>
  );
}
