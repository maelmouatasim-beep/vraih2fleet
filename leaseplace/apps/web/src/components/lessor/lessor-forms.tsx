"use client";

import { Ban, Send, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import {
  BUSINESS_SECTORS,
  DECLINE_REASONS,
  EQUIPMENT_CATEGORIES,
  GRADES,
  offerIssues,
  priceOffer,
  type OfferInput,
  type PaymentTiming,
  type Periodicity,
} from "@leaseplace/domain";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { Input } from "@leaseplace/ui/input";
import { Label } from "@leaseplace/ui/label";
import { Segmented } from "@leaseplace/ui/segmented";
import { FormField } from "@/components/company/fields";
import { useRouter } from "@/i18n/navigation";
import { formatMad, formatPercent, ltr, parseAmount } from "@/lib/format";
import type { AppetiteForm, OfferForm, OfferResult, SimpleResult } from "@/lib/lessor/actions";

const textareaClass =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg shadow-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none";

function MoneyInput({
  id,
  value,
  onChange,
  suffix = "DH HT",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="decimal"
        dir="ltr"
        className="tabular pe-16 text-end"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
      <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[12px] text-fg-subtle">
        {suffix}
      </span>
    </div>
  );
}

const isoInDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** Offre : conditions saisies, loyer, coût total et TEG recalculés en direct (et par le serveur). */
export function OfferFormPanel({
  targetId,
  requested,
  action,
}: {
  targetId: string;
  requested: {
    amountHt: number;
    durationMonths: number;
    periodicity: Periodicity;
    firstRentPct: number;
    residualPct: number;
  };
  action: (targetId: string, form: OfferForm) => Promise<OfferResult>;
}) {
  const t = useTranslations("lessor.offer");
  const tl = useTranslations("company.labels");
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OfferResult | null>(null);
  const [f, setF] = useState({
    amount: String(requested.amountHt),
    rate: "8.5",
    duration: String(requested.durationMonths),
    periodicity: requested.periodicity,
    timing: "advance" as PaymentTiming,
    firstRent: String(Math.round((requested.amountHt * requested.firstRentPct) / 100)),
    residual: String(Math.round((requested.amountHt * requested.residualPct) / 100)),
    fees: "0",
    insurance: "0",
    insuranceRequired: false,
    validUntil: isoInDays(30),
    conditions: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((s) => ({ ...s, [k]: v }));
  };
  const num = (v: string) => parseAmount(v) ?? Number.NaN;

  const form: OfferForm = {
    financedAmountHt: num(f.amount),
    durationMonths: Number.parseInt(f.duration, 10),
    periodicity: f.periodicity,
    timing: f.timing,
    annualRatePct: num(f.rate),
    firstRentHt: num(f.firstRent),
    residualValueHt: num(f.residual),
    fileFeesHt: num(f.fees),
    insurancePerPeriodHt: num(f.insurance),
    insuranceRequired: f.insuranceRequired,
    validUntil: f.validUntil,
    conditions: f.conditions,
  };
  const input: OfferInput = {
    ...form,
    annualRate: form.annualRatePct / 100,
    validUntil: new Date(`${f.validUntil}T23:59:59Z`),
  };
  const issues = offerIssues(input, requested.amountHt, new Date());
  // Calcul léger (moteur pur) : refait à chaque saisie.
  let priced: ReturnType<typeof priceOffer> | null = null;
  if (issues.length === 0) {
    try {
      priced = priceOffer(input);
    } catch {
      priced = null;
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await action(targetId, form);
          setResult(r);
          if (r.status === "submitted") router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${id}-amount`} label={t("amount")}>
          <MoneyInput
            id={`${id}-amount`}
            value={f.amount}
            onChange={(v) => {
              set("amount", v);
            }}
          />
        </FormField>
        <FormField id={`${id}-rate`} label={t("rate")} hint={t("rateHint")}>
          <MoneyInput
            id={`${id}-rate`}
            value={f.rate}
            onChange={(v) => {
              set("rate", v);
            }}
            suffix="%"
          />
        </FormField>
        <FormField id={`${id}-duration`} label={t("duration")}>
          <MoneyInput
            id={`${id}-duration`}
            value={f.duration}
            onChange={(v) => {
              set("duration", v);
            }}
            suffix={t("monthsSuffix")}
          />
        </FormField>
        <FormField id={`${id}-periodicity`} label={t("periodicity")} className="sm:col-span-2">
          <Segmented
            label={t("periodicity")}
            value={f.periodicity === "annual" ? "monthly" : f.periodicity}
            onChange={(v) => {
              set("periodicity", v);
            }}
            options={[
              { value: "monthly", label: tl("periodicities.monthly") },
              { value: "quarterly", label: tl("periodicities.quarterly") },
              { value: "semiannual", label: tl("periodicities.semiannual") },
            ]}
          />
        </FormField>
        <FormField id={`${id}-timing`} label={t("timing")} className="sm:col-span-2">
          <Segmented
            label={t("timing")}
            value={f.timing}
            onChange={(v) => {
              set("timing", v);
            }}
            options={[
              { value: "advance", label: t("advance") },
              { value: "arrears", label: t("arrears") },
            ]}
          />
        </FormField>
        <FormField id={`${id}-first`} label={t("firstRent")} hint={t("firstRentHint")}>
          <MoneyInput
            id={`${id}-first`}
            value={f.firstRent}
            onChange={(v) => {
              set("firstRent", v);
            }}
          />
        </FormField>
        <FormField id={`${id}-residual`} label={t("residual")}>
          <MoneyInput
            id={`${id}-residual`}
            value={f.residual}
            onChange={(v) => {
              set("residual", v);
            }}
          />
        </FormField>
        <FormField id={`${id}-fees`} label={t("fees")}>
          <MoneyInput
            id={`${id}-fees`}
            value={f.fees}
            onChange={(v) => {
              set("fees", v);
            }}
          />
        </FormField>
        <FormField id={`${id}-insurance`} label={t("insurance")}>
          <MoneyInput
            id={`${id}-insurance`}
            value={f.insurance}
            onChange={(v) => {
              set("insurance", v);
            }}
          />
        </FormField>
        <FormField id={`${id}-valid`} label={t("validUntil")}>
          <Input
            id={`${id}-valid`}
            type="date"
            dir="ltr"
            value={f.validUntil}
            onChange={(e) => {
              set("validUntil", e.target.value);
            }}
          />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-fg">
        <input
          type="checkbox"
          className="size-4 accent-[var(--lp-primary)]"
          checked={f.insuranceRequired}
          onChange={(e) => {
            set("insuranceRequired", e.target.checked);
          }}
        />
        {t("insuranceRequired")}
      </label>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-conditions`}>{t("conditions")}</Label>
        <textarea
          id={`${id}-conditions`}
          rows={3}
          maxLength={2000}
          className={textareaClass}
          value={f.conditions}
          onChange={(e) => {
            set("conditions", e.target.value);
          }}
        />
      </div>

      <div
        className="grid grid-cols-2 gap-3 rounded-lg bg-primary-soft/50 p-4"
        aria-live="polite"
        data-offer-preview
      >
        {(
          [
            [t("rent"), priced ? ltr(formatMad(priced.rentHt, 2)) : "—"],
            [t("firstRentComputed"), priced ? ltr(formatMad(priced.firstRentHt, 2)) : "—"],
            [t("cost"), priced ? ltr(formatMad(priced.normalized.totals.financingCostHt, 0)) : "—"],
            [
              t("effectiveRate"),
              priced ? ltr(formatPercent(priced.normalized.rates.annualEffectiveRate, 2)) : "—",
            ],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <p className="text-[12px] text-fg-muted">{k}</p>
            <p className="tabular text-[17px] font-semibold text-fg">{v}</p>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-[12px] text-fg-subtle">{t("computedNote")}</p>

      {issues.length > 0 ? (
        <Alert tone="warning">
          <ul className="list-disc ps-5">
            {issues.map((i) => (
              <li key={i}>{t(`issues.${i}`)}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {result?.status === "invalid" ? (
        <Alert tone="danger" role="alert">
          {result.issues.map((i) => t(`issues.${i}`)).join(" ")}
        </Alert>
      ) : null}
      {result?.status === "forbidden" ? (
        <Alert tone="danger" role="alert">
          {t("forbidden")}
        </Alert>
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="self-start"
        disabled={pending || issues.length > 0 || !priced}
      >
        <Send aria-hidden="true" />
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}

export function DeclinePanel({
  targetId,
  action,
}: {
  targetId: string;
  action: (id: string, reason: string, note: string) => Promise<SimpleResult>;
}) {
  const t = useTranslations("lessor.decline");
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState<string>("outside_appetite");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<SimpleResult | null>(null);
  return (
    <details className="rounded-md border border-border">
      <summary className="cursor-pointer list-none px-3 py-2 text-[13px] font-medium text-fg-muted [&::-webkit-details-marker]:hidden">
        {t("open")}
      </summary>
      <div className="flex flex-col gap-3 border-t border-border p-3">
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-fg">{t("reason")}</legend>
          <div className="flex flex-col gap-1.5">
            {DECLINE_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-[13px] text-fg">
                <input
                  type="radio"
                  name={`${id}-reason`}
                  value={r}
                  checked={reason === r}
                  onChange={() => {
                    setReason(r);
                  }}
                  className="accent-[var(--lp-primary)]"
                />
                {t(`reasons.${r}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-note`}>{t("note")}</Label>
          <textarea
            id={`${id}-note`}
            rows={2}
            className={textareaClass}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
          <p className="text-xs text-fg-subtle">{t("noteHint")}</p>
        </div>
        {result?.status === "invalid" ? (
          <p role="alert" className="text-xs text-danger">
            {t("noteRequired")}
          </p>
        ) : null}
        <Button
          variant="danger"
          size="sm"
          className="self-start"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const r = await action(targetId, reason, note);
              setResult(r);
              if (r.status === "done") router.refresh();
            });
          }}
        >
          <Ban aria-hidden="true" />
          {t("confirm")}
        </Button>
      </div>
    </details>
  );
}

export function WithdrawButton({
  targetId,
  action,
}: {
  targetId: string;
  action: (id: string) => Promise<SimpleResult>;
}) {
  const t = useTranslations("lessor.offer");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const r = await action(targetId);
          if (r.status === "done") router.refresh();
        });
      }}
    >
      <Undo2 aria-hidden="true" />
      {t("withdraw")}
    </Button>
  );
}

export function AppetiteEditor({
  initial,
  readOnly,
  action,
}: {
  initial: AppetiteForm;
  readOnly: boolean;
  action: (form: AppetiteForm) => Promise<SimpleResult>;
}) {
  const t = useTranslations("lessor.appetite");
  const tl = useTranslations("company.labels");
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [a, setA] = useState(initial);
  const [result, setResult] = useState<SimpleResult | null>(null);
  const toggle = <T extends string>(list: readonly T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await action(a);
          setResult(r);
          if (r.status === "done") router.refresh();
        });
      }}
    >
      <fieldset disabled={readOnly || pending} className="flex flex-col gap-5">
        <label className="flex items-center gap-2 text-[14px] font-medium text-fg">
          <input
            type="checkbox"
            className="size-4 accent-[var(--lp-primary)]"
            checked={a.active}
            onChange={(e) => {
              setA({ ...a, active: e.target.checked });
            }}
          />
          {t("active")}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["minAmountHt", t("minAmount"), "DH HT"],
              ["maxAmountHt", t("maxAmount"), "DH HT"],
              ["minDurationMonths", t("minDuration"), t("monthsSuffix")],
              ["maxDurationMonths", t("maxDuration"), t("monthsSuffix")],
            ] as const
          ).map(([k, label, suffix]) => (
            <FormField key={k} id={`${id}-${k}`} label={label}>
              <MoneyInput
                id={`${id}-${k}`}
                value={String(a[k])}
                suffix={suffix}
                onChange={(v) => {
                  setA({ ...a, [k]: parseAmount(v) ?? 0 });
                }}
              />
            </FormField>
          ))}
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-fg">{t("minGrade")}</legend>
          <div className="flex gap-1.5">
            {GRADES.map((g) => (
              <label key={g} className="relative">
                <input
                  type="radio"
                  name={`${id}-grade`}
                  checked={a.minGrade === g}
                  onChange={() => {
                    setA({ ...a, minGrade: g });
                  }}
                  className="peer sr-only"
                />
                <span className="flex size-9 cursor-pointer items-center justify-center rounded-md border border-border font-semibold text-fg peer-checked:border-primary peer-checked:bg-primary-soft peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                  {g}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-fg-subtle">{t("minGradeHint")}</p>
        </fieldset>
        {(
          [
            ["sectors", t("sectors"), BUSINESS_SECTORS, "sectors"],
            ["categories", t("categories"), EQUIPMENT_CATEGORIES, "equipmentCategories"],
          ] as const
        ).map(([key, label, values, labels]) => (
          <fieldset key={key}>
            <legend className="mb-1.5 text-[13px] font-medium text-fg">{label}</legend>
            <div className="flex flex-wrap gap-1.5">
              {values.map((v) => {
                const on = (a[key] as readonly string[]).includes(v);
                return (
                  <label key={v} className="relative">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={on}
                      onChange={() => {
                        setA({ ...a, [key]: toggle(a[key] as readonly string[], v) });
                      }}
                    />
                    <span className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-[12px] text-fg peer-checked:border-primary peer-checked:bg-primary-soft peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                      {tl(`${labels}.${v}`)}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-fg-subtle">{t("emptyMeansAll")}</p>
          </fieldset>
        ))}
      </fieldset>
      {result?.status === "invalid" ? (
        <Alert tone="danger" role="alert">
          {t("invalid")}
        </Alert>
      ) : null}
      {result?.status === "done" ? (
        <Alert tone="success" role="status">
          {t("saved")}
        </Alert>
      ) : null}
      {readOnly ? (
        <Alert tone="info">{t("readOnly")}</Alert>
      ) : (
        <Button type="submit" className="self-start" disabled={pending}>
          {t("save")}
        </Button>
      )}
    </form>
  );
}
