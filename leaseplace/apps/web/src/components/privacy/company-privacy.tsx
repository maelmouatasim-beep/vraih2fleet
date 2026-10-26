"use client";

import { Download, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ERASURE_SCOPE, type ErasureIssue } from "@leaseplace/domain";
import { Button } from "@leaseplace/ui/button";
import { Label } from "@leaseplace/ui/label";
import { useRouter } from "@/i18n/navigation";
import type { PrivacyResult } from "@/lib/privacy/actions";

interface Pending {
  id: string;
  requestedOn: string;
  dueOn: string;
}

/** Droits loi 09-08 du titulaire : export immédiat, demande d'effacement. */
export function CompanyPrivacy({
  canManage,
  pending,
  issues,
  lastDecision,
  actions,
}: {
  canManage: boolean;
  pending: Pending | null;
  issues: readonly ErasureIssue[];
  lastDecision: { status: string; on: string } | null;
  actions: {
    request: (note: string) => Promise<PrivacyResult>;
    cancel: (id: string) => Promise<PrivacyResult>;
  };
}) {
  const t = useTranslations("privacy.company");
  const uid = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<PrivacyResult | null>(null);
  const [busy, start] = useTransition();
  const run = (p: Promise<PrivacyResult>) => {
    start(async () => {
      const r = await p;
      setResult(r);
      if (r.status === "done") {
        setOpen(false);
        router.refresh();
      }
    });
  };
  return (
    <section aria-labelledby={`${uid}-title`} className="flex flex-col gap-4" data-privacy>
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 id={`${uid}-title`} className="text-[15px] font-semibold text-fg">
            {t("title")}
          </h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">{t("intro")}</p>
        </div>
      </div>
      {!canManage ? (
        <p className="text-[13px] text-fg-muted">{t("ownerOnly")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/export"
              download
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-[13px] font-medium hover:bg-surface-muted"
            >
              <Download className="size-4" aria-hidden="true" />
              {t("export")}
            </a>
            <span className="text-[12px] text-fg-subtle">{t("exportHint")}</span>
          </div>
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-[14px] font-medium text-fg">{t("erasureTitle")}</h3>
            <div className="mt-2 grid gap-3 text-[13px] sm:grid-cols-2">
              <div>
                <p className="font-medium text-fg">{t("erased")}</p>
                <ul className="mt-1 list-disc ps-5 text-fg-muted">
                  {ERASURE_SCOPE.erased.map((k) => (
                    <li key={k}>{t(`scope.${k}`)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-fg">{t("kept")}</p>
                <ul className="mt-1 list-disc ps-5 text-fg-muted">
                  {ERASURE_SCOPE.kept.map((k) => (
                    <li key={k}>{t(`scope.${k}`)}</li>
                  ))}
                </ul>
              </div>
            </div>
            {pending ? (
              <div className="mt-4 flex flex-wrap items-center gap-3" data-erasure-pending>
                <p className="text-[13px] text-fg">
                  {t("pending", { on: pending.requestedOn, due: pending.dueOn })}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    run(actions.cancel(pending.id));
                  }}
                >
                  {t("cancel")}
                </Button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {lastDecision ? (
                  <p className="text-[12px] text-fg-subtle">
                    {t(`last.${lastDecision.status}`, { on: lastDecision.on })}
                  </p>
                ) : null}
                {issues.length > 0 ? (
                  <ul className="flex flex-col gap-1 text-[13px] text-warning" role="note">
                    {issues.map((i) => (
                      <li key={i}>{t(`issues.${i}`)}</li>
                    ))}
                  </ul>
                ) : null}
                {!open ? (
                  <div>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setOpen(true);
                      }}
                    >
                      {t("ask")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`${uid}-note`}>{t("note")}</Label>
                      <textarea
                        id={`${uid}-note`}
                        rows={3}
                        maxLength={2000}
                        className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
                        value={note}
                        onChange={(e) => {
                          setNote(e.target.value);
                        }}
                      />
                    </div>
                    <label className="flex items-start gap-2 text-[13px] text-fg">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={confirmed}
                        onChange={(e) => {
                          setConfirmed(e.target.checked);
                        }}
                      />
                      {t("confirm")}
                    </label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy || !confirmed}
                        onClick={() => {
                          run(actions.request(note));
                        }}
                      >
                        {t("submit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setOpen(false);
                        }}
                      >
                        {t("back")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {result?.status === "invalid" ? (
              <p role="alert" className="mt-2 text-xs text-danger">
                {result.issues.map((i) => t(`errors.${i}`)).join(" ")}
              </p>
            ) : null}
            {result?.status === "forbidden" ? (
              <p role="alert" className="mt-2 text-xs text-danger">
                {t("forbidden")}
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
