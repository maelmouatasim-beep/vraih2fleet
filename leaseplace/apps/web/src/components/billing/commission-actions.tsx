"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { COMMISSION_CANCEL_REASONS } from "@leaseplace/domain";
import { Button } from "@leaseplace/ui/button";
import { Input } from "@leaseplace/ui/input";
import { Label } from "@leaseplace/ui/label";
import { useRouter } from "@/i18n/navigation";
import type { AdminResult } from "@/lib/billing/actions";

/** Facturer, encaisser ou annuler (avoir) une commission. */
export function CommissionActions({
  id,
  status,
  today,
  actions,
}: {
  id: string;
  status: string;
  today: string;
  actions: {
    invoice: (id: string) => Promise<AdminResult>;
    pay: (id: string, paidOn: string, reference: string) => Promise<AdminResult>;
    cancel: (id: string, reason: string, note: string) => Promise<AdminResult>;
  };
}) {
  const t = useTranslations("billing.commission");
  const uid = useId();
  const router = useRouter();
  const [mode, setMode] = useState<"pay" | "cancel" | null>(null);
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState<string>(COMMISSION_CANCEL_REASONS[0]);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();
  const run = (p: Promise<AdminResult>) => {
    start(async () => {
      const r = await p;
      setResult(r);
      if (r.status === "done") {
        setMode(null);
        router.refresh();
      }
    });
  };
  if (status !== "due" && status !== "invoiced") return <span className="text-fg-subtle">—</span>;
  return (
    <div className="flex flex-col items-end gap-2" data-commission-actions>
      <div className="flex flex-wrap justify-end gap-1.5">
        {status === "due" ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              run(actions.invoice(id));
            }}
          >
            {t("invoice")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setMode(mode === "pay" ? null : "pay");
            }}
          >
            {t("pay")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setMode(mode === "cancel" ? null : "cancel");
          }}
        >
          {t("cancel")}
        </Button>
      </div>
      {mode === "pay" ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${uid}-on`} className="text-xs">
              {t("paidOn")}
            </Label>
            <Input
              id={`${uid}-on`}
              type="date"
              dir="ltr"
              max={today}
              value={paidOn}
              onChange={(e) => {
                setPaidOn(e.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${uid}-ref`} className="text-xs">
              {t("reference")}
            </Label>
            <Input
              id={`${uid}-ref`}
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
              }}
            />
          </div>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              run(actions.pay(id, paidOn, reference));
            }}
          >
            {t("confirmPay")}
          </Button>
        </div>
      ) : null}
      {mode === "cancel" ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${uid}-reason`} className="text-xs">
              {t("reason")}
            </Label>
            <select
              id={`${uid}-reason`}
              className="h-10 rounded-md border border-border-strong bg-surface px-2 text-sm"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
              }}
            >
              {COMMISSION_CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reasons.${r}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${uid}-note`} className="text-xs">
              {t("note")}
            </Label>
            <Input
              id={`${uid}-note`}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
              }}
            />
          </div>
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => {
              run(actions.cancel(id, reason, note));
            }}
          >
            {t("confirmCancel")}
          </Button>
        </div>
      ) : null}
      {result?.status === "invalid" ? (
        <p role="alert" className="text-xs text-danger">
          {result.issues.map((i) => t(`issues.${i}`)).join(" ")}
        </p>
      ) : null}
      {result?.status === "forbidden" ? (
        <p role="alert" className="text-xs text-danger">
          {t("forbidden")}
        </p>
      ) : null}
    </div>
  );
}
