"use client";

import { Ban, CalendarCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import {
  COMPANY_CANCEL_REASONS,
  LESSOR_CANCEL_REASONS,
  nextDealStep,
  type DealSide,
  type DealStatus,
} from "@leaseplace/domain";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { Input } from "@leaseplace/ui/input";
import { Label } from "@leaseplace/ui/label";
import { useRouter } from "@/i18n/navigation";
import { parseAmount } from "@/lib/format";
import type { DealResult } from "@/lib/deals/actions";

const textareaClass =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg shadow-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none";

function Issues({ result }: { result: DealResult | null }) {
  const t = useTranslations("deals");
  if (result?.status === "invalid")
    return (
      <Alert tone="danger" role="alert">
        {result.issues.map((i) => t(`issues.${i}`)).join(" ")}
      </Alert>
    );
  if (result?.status === "forbidden")
    return (
      <Alert tone="danger" role="alert">
        {t("forbidden")}
      </Alert>
    );
  return null;
}

/** Étape suivante constatée par le bailleur : date (et montant définitif à la mise en loyer). */
export function DealStepPanel({
  dealId,
  status,
  financedAmountHt,
  today,
  action,
}: {
  dealId: string;
  status: DealStatus;
  financedAmountHt: number;
  today: string;
  action: (
    dealId: string,
    step: "sign" | "deliver" | "activate",
    on: string,
    amount?: number,
  ) => Promise<DealResult>;
}) {
  const t = useTranslations("deals");
  const id = useId();
  const router = useRouter();
  const step = nextDealStep(status);
  const [on, setOn] = useState(today);
  const [amount, setAmount] = useState(String(financedAmountHt));
  const [result, setResult] = useState<DealResult | null>(null);
  const [pending, start] = useTransition();
  if (!step) return null;
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4" data-deal-step={step}>
      <p className="text-[14px] font-medium text-fg">{t(`next.${step}`)}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-on`}>{t(`dateLabels.${step}`)}</Label>
          <Input
            id={`${id}-on`}
            type="date"
            dir="ltr"
            max={today}
            value={on}
            onChange={(e) => {
              setOn(e.target.value);
            }}
          />
        </div>
        {step === "activate" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-amount`}>{t("finalAmount")}</Label>
            <Input
              id={`${id}-amount`}
              inputMode="decimal"
              dir="ltr"
              className="tabular text-end"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
              }}
            />
          </div>
        ) : null}
      </div>
      <Issues result={result} />
      <Button
        className="self-start"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const r = await action(
              dealId,
              step,
              on,
              step === "activate" ? (parseAmount(amount) ?? Number.NaN) : undefined,
            );
            setResult(r);
            if (r.status === "done") router.refresh();
          });
        }}
      >
        <CalendarCheck aria-hidden="true" />
        {t(`confirm.${step}`)}
      </Button>
    </div>
  );
}

/** Annulation motivée, par l'entreprise (avant signature) ou le bailleur. */
export function DealCancelPanel({
  dealId,
  side,
  action,
}: {
  dealId: string;
  side: DealSide;
  action: (dealId: string, reason: string, note: string) => Promise<DealResult>;
}) {
  const t = useTranslations("deals");
  const id = useId();
  const router = useRouter();
  const reasons = side === "lessor" ? LESSOR_CANCEL_REASONS : COMPANY_CANCEL_REASONS;
  const [reason, setReason] = useState<string>(reasons[0]);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<DealResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <details className="rounded-md border border-border" data-deal-cancel>
      <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-fg-muted">
        {t(`cancel.open.${side}`)}
      </summary>
      <div className="flex flex-col gap-3 border-t border-border p-3">
        <p className="text-[13px] text-fg-muted">{t(`cancel.body.${side}`)}</p>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-fg">{t("cancel.reason")}</legend>
          <div className="flex flex-col gap-1.5">
            {reasons.map((r) => (
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
          <Label htmlFor={`${id}-note`}>{t("cancel.note")}</Label>
          <textarea
            id={`${id}-note`}
            rows={2}
            className={textareaClass}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
        </div>
        <Issues result={result} />
        <Button
          variant="danger"
          size="sm"
          className="self-start"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const r = await action(dealId, reason, note);
              setResult(r);
              if (r.status === "done") router.refresh();
            });
          }}
        >
          <Ban aria-hidden="true" />
          {t("cancel.confirm")}
        </Button>
      </div>
    </details>
  );
}
