"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ERASURE_REJECT_REASONS } from "@leaseplace/domain";
import { Button } from "@leaseplace/ui/button";
import { Input } from "@leaseplace/ui/input";
import { Label } from "@leaseplace/ui/label";
import { useRouter } from "@/i18n/navigation";
import type { PrivacyResult } from "@/lib/privacy/actions";

function useRun() {
  const router = useRouter();
  const [result, setResult] = useState<PrivacyResult | null>(null);
  const [busy, start] = useTransition();
  const run = (p: Promise<PrivacyResult>, onDone?: () => void) => {
    start(async () => {
      const r = await p;
      setResult(r);
      if (r.status === "done") {
        onDone?.();
        router.refresh();
      }
    });
  };
  return { result, busy, run };
}

function Feedback({ result, ns }: { result: PrivacyResult | null; ns: "admin" | "retention" }) {
  const t = useTranslations(`privacy.${ns}`);
  if (result?.status === "invalid")
    return (
      <p role="alert" className="text-xs text-danger">
        {result.issues.map((i) => t(`errors.${i}`)).join(" ")}
      </p>
    );
  if (result?.status === "forbidden")
    return (
      <p role="alert" className="text-xs text-danger">
        {t("forbidden")}
      </p>
    );
  return null;
}

/** Exécuter ou refuser une demande d'effacement. */
export function ErasureActions({
  id,
  blocked,
  actions,
}: {
  id: string;
  blocked: boolean;
  actions: {
    execute: (id: string) => Promise<PrivacyResult>;
    reject: (id: string, reason: string, note: string) => Promise<PrivacyResult>;
  };
}) {
  const t = useTranslations("privacy.admin");
  const uid = useId();
  const [mode, setMode] = useState<"execute" | "reject" | null>(null);
  const [reason, setReason] = useState<string>(ERASURE_REJECT_REASONS[0]);
  const [note, setNote] = useState("");
  const { result, busy, run } = useRun();
  return (
    <div className="flex flex-col items-end gap-2" data-erasure-actions>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="danger"
          disabled={busy || blocked}
          onClick={() => {
            setMode(mode === "execute" ? null : "execute");
          }}
        >
          {t("execute")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setMode(mode === "reject" ? null : "reject");
          }}
        >
          {t("reject")}
        </Button>
      </div>
      {mode === "execute" ? (
        <div className="flex max-w-sm flex-col items-end gap-2 text-end">
          <p className="text-xs text-fg-muted">{t("executeWarning")}</p>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => {
              run(actions.execute(id), () => {
                setMode(null);
              });
            }}
          >
            {t("confirmExecute")}
          </Button>
        </div>
      ) : null}
      {mode === "reject" ? (
        <div className="flex flex-wrap items-end justify-end gap-2">
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
              {ERASURE_REJECT_REASONS.map((r) => (
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
            disabled={busy}
            onClick={() => {
              run(actions.reject(id, reason, note), () => {
                setMode(null);
              });
            }}
          >
            {t("confirmReject")}
          </Button>
        </div>
      ) : null}
      <Feedback result={result} ns="admin" />
    </div>
  );
}

/** Durée de conservation d'une règle. */
export function RetentionField({
  ruleKey,
  days,
  min,
  max,
  canEdit,
  save,
}: {
  ruleKey: string;
  days: number;
  min: number;
  max: number;
  canEdit: boolean;
  save: (key: string, days: number) => Promise<PrivacyResult>;
}) {
  const t = useTranslations("privacy.retention");
  const uid = useId();
  const [value, setValue] = useState(String(days));
  const { result, busy, run } = useRun();
  const changed = Number(value) !== days;
  return (
    <div className="flex flex-col items-end gap-1" data-retention={ruleKey}>
      <div className="flex items-center gap-2">
        <Label htmlFor={`${uid}-days`} className="sr-only">
          {t("days")}
        </Label>
        <Input
          id={`${uid}-days`}
          type="number"
          inputMode="numeric"
          dir="ltr"
          className="w-24 text-end"
          min={min}
          max={max}
          disabled={!canEdit}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
        />
        <span className="text-[12px] text-fg-muted">{t("unit")}</span>
        {canEdit ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !changed}
            onClick={() => {
              run(save(ruleKey, Number(value)));
            }}
          >
            {t("save")}
          </Button>
        ) : null}
      </div>
      <Feedback result={result} ns="retention" />
    </div>
  );
}

/** Lancer la purge sans attendre la tâche planifiée. */
export function RunRetention({ run: action }: { run: () => Promise<PrivacyResult> }) {
  const t = useTranslations("privacy.retention");
  const { result, busy, run } = useRun();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={busy}
        onClick={() => {
          run(action());
        }}
      >
        {t("run")}
      </Button>
      {result?.status === "done" && result.summary ? (
        <p role="status" className="text-xs text-fg-muted" data-retention-result>
          {t("ran", {
            drafts: result.summary.drafts ?? 0,
            notifications: result.summary.notifications ?? 0,
            files: result.summary.files ?? 0,
          })}
        </p>
      ) : null}
      <Feedback result={result} ns="retention" />
    </div>
  );
}
