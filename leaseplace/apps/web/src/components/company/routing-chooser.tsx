"use client";

import { Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { cn } from "@leaseplace/ui/cn";
import { useRouter } from "@/i18n/navigation";
import type { SendResult } from "@/lib/routing/company";

export interface RoutingChoice {
  lessorId: string;
  name: string;
  proposed: boolean;
}

/** Choix nominatif des bailleurs destinataires, puis consentement de transmission. */
export function RoutingChooser({
  requestId,
  maxTargets,
  choices,
  consentText,
  canConsent,
  action,
}: {
  requestId: string;
  maxTargets: number;
  choices: readonly RoutingChoice[];
  consentText: string;
  canConsent: boolean;
  action: (id: string, lessors: string[], consent: boolean, locale: string) => Promise<SendResult>;
}) {
  const t = useTranslations("company.routing");
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(
    choices.filter((c) => c.proposed).map((c) => c.lessorId),
  );
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [pending, start] = useTransition();
  const full = selected.length >= maxTargets;

  if (choices.length === 0) return <Alert tone="warning">{t("noLessor")}</Alert>;

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 flex w-full items-baseline justify-between gap-3 text-[13px] font-medium text-fg">
          <span>{t("chooseLabel", { max: maxTargets })}</span>
          <span className="tabular text-fg-muted" aria-live="polite">
            {t("selectedCount", { count: selected.length, max: maxTargets })}
          </span>
        </legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {choices.map((c) => {
            const checked = selected.includes(c.lessorId);
            const disabled = !checked && full;
            return (
              <li key={c.lessorId}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-[14px] transition-colors",
                    checked
                      ? "border-primary bg-primary-soft/50"
                      : "border-border bg-surface hover:border-border-strong",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                  data-lessor={c.name}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--lp-primary)]"
                    checked={checked}
                    disabled={disabled || !canConsent}
                    onChange={(e) => {
                      setSelected((s) =>
                        e.target.checked ? [...s, c.lessorId] : s.filter((x) => x !== c.lessorId),
                      );
                    }}
                  />
                  <span className="flex-1 font-medium text-fg">{c.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[12px] text-fg-subtle">{t("neutralOrder")}</p>
      </fieldset>
      <blockquote
        className="rounded-md border border-border bg-surface-muted/60 p-4 text-[14px] leading-relaxed text-fg"
        data-routing-consent
      >
        {consentText}
      </blockquote>
      {canConsent ? (
        <label className="flex items-start gap-2.5 text-[14px] text-fg">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
            }}
            className="mt-1 size-4 accent-[var(--lp-primary)]"
          />
          <span>{t("consentCheckbox")}</span>
        </label>
      ) : (
        <Alert tone="info">{t("ownerOnly")}</Alert>
      )}
      {result?.status === "invalid" ? (
        <Alert tone="danger" role="alert">
          {result.issues.map((i) => t(`issues.${i}`)).join(" ")}
        </Alert>
      ) : null}
      <Button
        size="lg"
        className="self-start"
        disabled={pending || !canConsent || !consent || selected.length === 0}
        onClick={() => {
          start(async () => {
            const r = await action(requestId, selected, consent, locale);
            setResult(r);
            if (r.status === "sent") router.refresh();
          });
        }}
      >
        <Send aria-hidden="true" />
        {pending ? t("sending") : t("send", { count: selected.length })}
      </Button>
    </div>
  );
}
