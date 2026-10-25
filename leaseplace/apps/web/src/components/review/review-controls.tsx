"use client";

import { Check, FileSearch, Play, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { Label } from "@leaseplace/ui/label";
import { useRouter } from "@/i18n/navigation";
import type {
  AnalysisResult,
  MemoResult,
  NoteResult,
  OverrideResult,
  QualifyResult,
} from "@/lib/review/actions";

/** Action avec état d'attente et rafraîchissement de la page. */
function useAction<R>() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<R | null>(null);
  const run = (fn: () => Promise<R>) => {
    start(async () => {
      const r = await fn();
      setResult(r);
      router.refresh();
    });
  };
  return { pending, result, run };
}

const textareaClass =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg shadow-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none";

export function AnalysisButton({
  mode,
  requestId,
  action,
}: {
  mode: "start" | "rerun";
  requestId: string;
  action: (id: string) => Promise<AnalysisResult>;
}) {
  const t = useTranslations("review.actions");
  const { pending, result, run } = useAction<AnalysisResult>();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant={mode === "start" ? "primary" : "secondary"}
        size="sm"
        disabled={pending}
        onClick={() => {
          run(() => action(requestId));
        }}
      >
        {mode === "start" ? <Play aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
        {pending ? t("analyzing") : t(mode === "start" ? "start" : "rerun")}
      </Button>
      {result?.status === "analyzed" ? (
        <span role="status" className="text-xs text-fg-muted">
          {t("analyzed", { extracted: result.extracted, failed: result.failed })}
        </span>
      ) : null}
    </span>
  );
}

export function GenerateMemoButton({
  requestId,
  action,
  hasDraft,
}: {
  requestId: string;
  action: (id: string) => Promise<MemoResult>;
  hasDraft: boolean;
}) {
  const t = useTranslations("review.memo");
  const { pending, result, run } = useAction<MemoResult>();
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant={hasDraft ? "secondary" : "primary"}
        disabled={pending}
        onClick={() => {
          run(() => action(requestId));
        }}
        className="self-start"
      >
        <Sparkles aria-hidden="true" />
        {pending ? t("generating") : t(hasDraft ? "regenerate" : "generate")}
      </Button>
      {result?.status === "rejected" ? (
        <Alert tone="warning" role="alert">
          <div>
            <p className="font-medium">{t("rejected")}</p>
            <ul className="mt-1 list-disc ps-5 text-[13px]">
              {result.issues.slice(0, 6).map((i, k) => (
                <li key={k}>
                  {t(`issues.${i.code}`)}
                  {i.detail ? ` : ${i.detail}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </Alert>
      ) : null}
      {result?.status === "failed" ? (
        <Alert tone="danger" role="alert">
          {t("failed", { code: result.code })}
        </Alert>
      ) : null}
    </div>
  );
}

export function MemoDecision({
  memoId,
  action,
}: {
  memoId: string;
  action: (id: string, decision: "approved" | "discarded") => Promise<NoteResult>;
}) {
  const t = useTranslations("review.memo");
  const { pending, run } = useAction<NoteResult>();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => {
          run(() => action(memoId, "approved"));
        }}
      >
        <ShieldCheck aria-hidden="true" />
        {t("approve")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          run(() => action(memoId, "discarded"));
        }}
      >
        <X aria-hidden="true" />
        {t("discard")}
      </Button>
    </div>
  );
}

export function DocumentDecision({
  documentId,
  name,
  action,
}: {
  documentId: string;
  name: string;
  action: (id: string, decision: "verified" | "rejected", note: string) => Promise<NoteResult>;
}) {
  const t = useTranslations("review.documents");
  const id = useId();
  const { pending, result, run } = useAction<NoteResult>();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          aria-label={t("verifyLabel", { name })}
          onClick={() => {
            run(() => action(documentId, "verified", ""));
          }}
        >
          <Check aria-hidden="true" />
          {t("verify")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          aria-expanded={rejecting}
          aria-label={t("rejectLabel", { name })}
          onClick={() => {
            setRejecting((v) => !v);
          }}
        >
          <X aria-hidden="true" />
          {t("reject")}
        </Button>
      </div>
      {rejecting ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-note`}>{t("rejectReason")}</Label>
          <textarea
            id={`${id}-note`}
            rows={2}
            className={textareaClass}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            className="self-start"
            onClick={() => {
              run(() => action(documentId, "rejected", note));
            }}
          >
            {t("confirmReject")}
          </Button>
          {result?.status === "invalid" ? (
            <p role="alert" className="text-xs text-danger">
              {t("noteTooShort")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function OverrideForm({
  assessmentId,
  current,
  grades,
  action,
}: {
  assessmentId: string;
  current: string;
  grades: readonly string[];
  action: (id: string, grade: string, reason: string) => Promise<OverrideResult>;
}) {
  const t = useTranslations("review.score");
  const id = useId();
  const { pending, result, run } = useAction<OverrideResult>();
  const [grade, setGrade] = useState(current);
  const [reason, setReason] = useState("");
  return (
    <details className="group rounded-md border border-border">
      <summary className="cursor-pointer list-none px-3 py-2 text-[13px] font-medium text-primary [&::-webkit-details-marker]:hidden">
        {t("override")}
      </summary>
      <form
        className="flex flex-col gap-3 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => action(assessmentId, grade, reason));
        }}
      >
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-fg">{t("newGrade")}</legend>
          <div className="flex gap-1.5">
            {grades.map((g) => (
              <label key={g} className="relative">
                <input
                  type="radio"
                  name={`${id}-grade`}
                  value={g}
                  checked={grade === g}
                  onChange={() => {
                    setGrade(g);
                  }}
                  className="peer sr-only"
                />
                <span className="flex size-9 cursor-pointer items-center justify-center rounded-md border border-border font-semibold text-fg peer-checked:border-primary peer-checked:bg-primary-soft peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                  {g}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-reason`}>{t("reason")}</Label>
          <textarea
            id={`${id}-reason`}
            rows={3}
            className={textareaClass}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
          />
          <p className="text-xs text-fg-subtle">{t("reasonHint")}</p>
        </div>
        {result?.status === "invalid" ? (
          <Alert tone="danger" role="alert">
            {result.issues.map((i) => t(`overrideIssues.${i}`)).join(" ")}
          </Alert>
        ) : null}
        {result?.status === "done" ? (
          <Alert tone="success" role="status">
            {t("overridden")}
          </Alert>
        ) : null}
        <Button type="submit" size="sm" disabled={pending} className="self-start">
          {t("saveOverride")}
        </Button>
      </form>
    </details>
  );
}

export function DecisionPanel({
  requestId,
  hasFailures,
  requestInfo,
  qualify,
}: {
  requestId: string;
  hasFailures: boolean;
  requestInfo: (id: string, note: string) => Promise<NoteResult>;
  qualify: (id: string, note: string) => Promise<QualifyResult>;
}) {
  const t = useTranslations("review.decision");
  const id = useId();
  const info = useAction<NoteResult>();
  const qual = useAction<QualifyResult>();
  const [infoNote, setInfoNote] = useState("");
  const [anomalies, setAnomalies] = useState("");
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <h3 className="text-[14px] font-semibold text-fg">{t("qualifyTitle")}</h3>
        <p className="text-[13px] text-fg-muted">{t("qualifyBody")}</p>
        {hasFailures ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-anomalies`}>{t("anomaliesLabel")}</Label>
            <textarea
              id={`${id}-anomalies`}
              rows={3}
              className={textareaClass}
              value={anomalies}
              onChange={(e) => {
                setAnomalies(e.target.value);
              }}
            />
          </div>
        ) : null}
        {qual.result?.status === "blocked" ? (
          <Alert tone="warning" role="alert">
            <ul className="list-disc ps-5">
              {qual.result.issues.map((i) => (
                <li key={i}>{t(`issues.${i}`)}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        <Button
          size="sm"
          disabled={qual.pending}
          className="self-start"
          onClick={() => {
            qual.run(() => qualify(requestId, anomalies));
          }}
        >
          <ShieldCheck aria-hidden="true" />
          {t("qualify")}
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-[14px] font-semibold text-fg">{t("infoTitle")}</h3>
        <Label htmlFor={`${id}-info`}>{t("infoLabel")}</Label>
        <textarea
          id={`${id}-info`}
          rows={3}
          className={textareaClass}
          value={infoNote}
          onChange={(e) => {
            setInfoNote(e.target.value);
          }}
        />
        <p className="text-xs text-fg-subtle">{t("infoHint")}</p>
        {info.result?.status === "invalid" ? (
          <p role="alert" className="text-xs text-danger">
            {t("noteTooShort")}
          </p>
        ) : null}
        <Button
          size="sm"
          variant="secondary"
          disabled={info.pending}
          className="self-start"
          onClick={() => {
            info.run(() => requestInfo(requestId, infoNote));
          }}
        >
          <FileSearch aria-hidden="true" />
          {t("requestInfo")}
        </Button>
      </div>
    </div>
  );
}
