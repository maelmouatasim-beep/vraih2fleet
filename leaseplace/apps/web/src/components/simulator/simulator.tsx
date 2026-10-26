"use client";

import { Check, ChevronDown, Info, Link2, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_VAT_RATE, toTtc } from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";
import { Button } from "@leaseplace/ui/button";
import { Card } from "@leaseplace/ui/card";
import { Input } from "@leaseplace/ui/input";
import { Label } from "@leaseplace/ui/label";
import { Segmented } from "@leaseplace/ui/segmented";
import { Slider } from "@leaseplace/ui/slider";
import { cn } from "@leaseplace/ui/cn";
import {
  formatMad as mad,
  formatNumber,
  formatPercent as pct,
  ltr,
  parseAmount,
} from "@/lib/format";

// Montants et taux toujours isolés de gauche à droite (affichage en arabe).
const formatMad = (value: number, decimals?: number) => ltr(mad(value, decimals));
const formatPercent = (fraction: number, decimals?: number) => ltr(pct(fraction, decimals));
import { LIMITS, simulate, toSearchParams, type SimulatorParams } from "@/lib/simulator";
import { useSimulatorTracking } from "@/lib/analytics-client";

type Setter = <K extends keyof SimulatorParams>(key: K, value: SimulatorParams[K]) => void;

function clamp(value: number, { min, max }: { min: number; max: number }) {
  return Math.min(max, Math.max(min, value));
}

function Field({
  label,
  htmlFor,
  value,
  children,
}: {
  label: string;
  htmlFor?: string;
  value?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {value ? <span className="tabular text-[13px] font-medium text-fg">{value}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** Champ numérique saisi en clair (« 1 250 000 »), validé à la sortie du champ. */
function NumberInput({
  id,
  value,
  onCommit,
  limits,
  suffix,
  decimals = 0,
}: {
  id: string;
  value: number;
  onCommit: (v: number) => void;
  limits: { min: number; max: number };
  suffix: string;
  decimals?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const parsed = parseAmount(draft);
    if (parsed !== null) onCommit(clamp(parsed, limits));
    setDraft(null);
  };
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="decimal"
        dir="ltr"
        className={cn("tabular text-end font-medium", suffix.length > 2 ? "pe-16" : "pe-9")}
        value={draft ?? formatNumber(value, decimals)}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
      <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[13px] text-fg-subtle">
        {suffix}
      </span>
    </div>
  );
}

function Parameters({ p, set }: { p: SimulatorParams; set: Setter }) {
  const t = useTranslations("simulator");
  const ids = {
    amount: useId(),
    rate: useId(),
    fees: useId(),
    tax: useId(),
    discount: useId(),
    life: useId(),
  };
  return (
    <Card className="flex flex-col gap-6 p-5">
      <Field label={t("amount")} htmlFor={ids.amount}>
        <NumberInput
          id={ids.amount}
          value={p.amount}
          limits={LIMITS.amount}
          suffix="DH HT"
          onCommit={(v) => {
            set("amount", v);
          }}
        />
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
      </Field>

      <Field label={t("duration")} value={t("months", { n: p.months })}>
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
      </Field>

      <Field
        label={t("firstRent")}
        value={
          p.firstRentPct === 0
            ? t("none")
            : `${formatPercent(p.firstRentPct / 100, 0)} · ${formatMad((p.amount * p.firstRentPct) / 100, 0)}`
        }
      >
        <Slider
          label={t("firstRent")}
          valueText={formatPercent(p.firstRentPct / 100, 0)}
          min={LIMITS.firstRentPct.min}
          max={LIMITS.firstRentPct.max}
          step={1}
          value={p.firstRentPct}
          onValueChange={(v) => {
            set("firstRentPct", v);
          }}
        />
      </Field>

      <Field
        label={t("residual")}
        value={`${formatPercent(p.residualPct / 100, 0)} · ${formatMad((p.amount * p.residualPct) / 100, 0)}`}
      >
        <Slider
          label={t("residual")}
          valueText={formatPercent(p.residualPct / 100, 0)}
          min={LIMITS.residualPct.min}
          max={LIMITS.residualPct.max}
          step={1}
          value={p.residualPct}
          onValueChange={(v) => {
            set("residualPct", v);
          }}
        />
      </Field>

      <div className="grid gap-5">
        <Field label={t("periodicity")}>
          <Segmented
            label={t("periodicity")}
            value={p.periodicity}
            onChange={(v) => {
              set("periodicity", v);
            }}
            options={[
              { value: "monthly", label: t("periodicities.monthly") },
              { value: "quarterly", label: t("periodicities.quarterly") },
              { value: "semiannual", label: t("periodicities.semiannual") },
            ]}
          />
        </Field>
        <Field label={t("timing")}>
          <Segmented
            label={t("timing")}
            value={p.timing}
            onChange={(v) => {
              set("timing", v);
            }}
            options={[
              { value: "advance", label: t("timings.advance") },
              { value: "arrears", label: t("timings.arrears") },
            ]}
          />
        </Field>
      </div>

      <Field label={t("rate")} htmlFor={ids.rate}>
        <NumberInput
          id={ids.rate}
          value={p.ratePct}
          decimals={2}
          limits={LIMITS.ratePct}
          suffix="%"
          onCommit={(v) => {
            set("ratePct", v);
          }}
        />
        <p className="text-xs text-fg-subtle">{t("rateHint")}</p>
      </Field>

      <details className="group rounded-md border border-border">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          <span className="flex-1">{t("advanced")}</span>
          <ChevronDown
            className="size-4 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="grid gap-4 border-t border-border p-3 sm:grid-cols-2">
          <Field label={t("fees")} htmlFor={ids.fees}>
            <NumberInput
              id={ids.fees}
              value={p.feesHt}
              limits={LIMITS.feesHt}
              suffix="DH HT"
              onCommit={(v) => {
                set("feesHt", v);
              }}
            />
          </Field>
          <Field label={t("tax")} htmlFor={ids.tax}>
            <NumberInput
              id={ids.tax}
              value={p.taxPct}
              decimals={1}
              limits={LIMITS.taxPct}
              suffix="%"
              onCommit={(v) => {
                set("taxPct", v);
              }}
            />
          </Field>
          <Field label={t("discount")} htmlFor={ids.discount}>
            <NumberInput
              id={ids.discount}
              value={p.discountPct}
              decimals={1}
              limits={LIMITS.discountPct}
              suffix="%"
              onCommit={(v) => {
                set("discountPct", v);
              }}
            />
          </Field>
          <Field label={t("usefulLife")} htmlFor={ids.life}>
            <NumberInput
              id={ids.life}
              value={p.usefulLifeYears}
              limits={LIMITS.usefulLifeYears}
              suffix={t("years")}
              onCommit={(v) => {
                set("usefulLifeYears", Math.round(v));
              }}
            />
          </Field>
        </div>
      </details>
    </Card>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md bg-surface-muted/70 px-3.5 py-3">
      <dt className="text-[12px] text-fg-muted">{label}</dt>
      <dd className="tabular mt-1 text-[17px] font-semibold tracking-tight text-fg">{value}</dd>
      {hint ? <dd className="mt-0.5 text-[11px] text-fg-subtle">{hint}</dd> : null}
    </div>
  );
}

export function Simulator({ initial }: { initial: SimulatorParams }) {
  const t = useTranslations("simulator");
  const [p, setP] = useState(initial);
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => simulate(p), [p]);
  useSimulatorTracking(p);
  const set: Setter = (key, value) => {
    setP((prev) => ({ ...prev, [key]: value }));
  };

  // Simulation partageable : l'URL suit les paramètres, sans recharger la page.
  useEffect(() => {
    const qs = toSearchParams(p).toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [p]);

  const copyLink = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <Parameters p={p} set={set} />

      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        {result.ok ? (
          <>
            <Card className="overflow-hidden">
              <div
                className="border-b border-border bg-primary-soft/40 px-5 py-5"
                aria-live="polite"
              >
                <p className="text-[13px] font-medium text-fg-muted">
                  {t(`rentLabel.${p.periodicity}`)}
                </p>
                <p
                  className="tabular mt-1 text-[34px] leading-none font-semibold tracking-tight text-fg"
                  data-testid="loyer"
                >
                  {formatMad(result.pricing.rentHt)}
                </p>
                <p className="tabular mt-2 text-[13px] text-fg-muted">
                  {t("rentTtc", {
                    amount: formatMad(toTtc(result.pricing.rentHt, DEFAULT_VAT_RATE)),
                  })}
                  {p.firstRentPct > 0
                    ? ` · ${t("firstRentLine", { amount: formatMad(result.firstRentHt) })}`
                    : ""}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-2 p-4">
                <Kpi
                  label={t("financingCost")}
                  value={formatMad(result.offer.totals.financingCostHt, 0)}
                  hint={t("financingCostHint")}
                />
                <Kpi
                  label={t("teg")}
                  value={formatPercent(result.offer.rates.annualEffectiveRate)}
                  hint={t("tegHint")}
                />
                <Kpi
                  label={t("totalTtc")}
                  value={formatMad(result.offer.totals.paidTtc, 0)}
                  hint={t("totalTtcHint")}
                />
                <Kpi
                  label={t("residualValue")}
                  value={formatMad(result.residualHt, 0)}
                  hint={t("residualHint")}
                />
              </dl>
            </Card>

            <Comparison result={result} discountPct={p.discountPct} taxPct={p.taxPct} />
            <Schedule result={result} />
          </>
        ) : (
          <Card className="p-5 text-sm text-danger" role="alert">
            {t("inconsistent")}
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={copyLink}>
            {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
            {copied ? t("linkCopied") : t("copyLink")}
          </Button>
          <Button disabled aria-describedby="demande-bientot">
            {t("apply")}
          </Button>
          <span id="demande-bientot" className="self-center text-xs text-fg-subtle">
            {t("applySoon")}
          </span>
        </div>

        <p className="flex gap-2 text-xs leading-relaxed text-fg-subtle">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{t("disclaimer")}</span>
        </p>
      </div>
    </div>
  );
}

function Comparison({
  result,
  discountPct,
  taxPct,
}: {
  result: Extract<ReturnType<typeof simulate>, { ok: true }>;
  discountPct: number;
  taxPct: number;
}) {
  const t = useTranslations("simulator");
  const rows = [
    {
      key: "lease",
      value: result.comparison.lease.presentCostAfterTax,
      outflow: result.comparison.lease.totalOutflowHt,
    },
    {
      key: "loan",
      value: result.comparison.loan.presentCostAfterTax,
      outflow: result.comparison.loan.totalOutflowHt,
    },
    {
      key: "cash",
      value: result.comparison.cash.presentCostAfterTax,
      outflow: result.comparison.cash.totalOutflowHt,
    },
  ] as const;
  const max = Math.max(...rows.map((r) => r.value));
  const best = rows.reduce((a, b) => (b.value < a.value ? b : a));
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold text-fg">{t("compareTitle")}</h2>
      <p className="mt-1 text-[13px] text-fg-muted">
        {t("compareBody", {
          discount: formatPercent(discountPct / 100, 1),
          tax: formatPercent(taxPct / 100, 1),
        })}
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="flex items-center gap-2 font-medium text-fg">
                {t(`options.${r.key}`)}
                {r.key === best.key ? <Badge tone="success">{t("cheapest")}</Badge> : null}
              </span>
              <span className="tabular font-semibold text-fg">{formatMad(r.value, 0)}</span>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken"
              aria-hidden="true"
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  r.key === best.key ? "bg-primary" : "bg-border-strong",
                )}
                style={{ width: `${String(Math.max(4, (r.value / max) * 100))}%` }}
              />
            </div>
            <p className="tabular mt-1 text-[11px] text-fg-subtle">
              {t("outflow", { amount: formatMad(r.outflow, 0) })}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] leading-relaxed text-fg-subtle">{t("compareHypotheses")}</p>
    </Card>
  );
}

function Schedule({ result }: { result: Extract<ReturnType<typeof simulate>, { ok: true }> }) {
  const t = useTranslations("simulator");
  const { schedule, totals } = result.offer;
  return (
    <details className="group rounded-lg border border-border bg-surface shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-[14px] font-semibold text-fg [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{t("scheduleTitle", { n: schedule.length })}</span>
        <ChevronDown
          className="size-4 text-fg-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="max-h-96 overflow-auto border-t border-border">
        <table className="w-full min-w-[480px] text-[12px]">
          <thead className="sticky top-0 bg-surface-muted text-fg-muted">
            <tr>
              <th scope="col" className="px-4 py-2 text-start font-medium">
                {t("columns.month")}
              </th>
              <th scope="col" className="px-4 py-2 text-start font-medium">
                {t("columns.item")}
              </th>
              <th scope="col" className="px-4 py-2 text-end font-medium">
                {t("columns.ht")}
              </th>
              <th scope="col" className="px-4 py-2 text-end font-medium">
                {t("columns.vat")}
              </th>
              <th scope="col" className="px-4 py-2 text-end font-medium">
                {t("columns.ttc")}
              </th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-border">
            {schedule.map((l) => (
              <tr key={l.month}>
                <td className="px-4 py-1.5 text-fg-muted">{l.month}</td>
                <td className="px-4 py-1.5 whitespace-nowrap text-fg">
                  {[
                    l.rentNumber === null ? null : t("rentN", { n: l.rentNumber }),
                    l.feesHt > 0 ? t("fees") : null,
                    l.residualHt > 0 ? t("residualShort") : null,
                  ]
                    .filter(Boolean)
                    .join(" + ")}
                </td>
                <td className="px-4 py-1.5 text-end">{formatMad(l.totalHt)}</td>
                <td className="px-4 py-1.5 text-end text-fg-muted">{formatMad(l.vat)}</td>
                <td className="px-4 py-1.5 text-end font-medium">{formatMad(l.totalTtc)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="tabular sticky bottom-0 border-t border-border-strong bg-surface font-semibold">
            <tr>
              <td className="px-4 py-2" colSpan={2}>
                {t("total")}
              </td>
              <td className="px-4 py-2 text-end">{formatMad(totals.paidHt)}</td>
              <td className="px-4 py-2 text-end">{formatMad(totals.vat)}</td>
              <td className="px-4 py-2 text-end">{formatMad(totals.paidTtc)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </details>
  );
}
