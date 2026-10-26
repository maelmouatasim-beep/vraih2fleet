"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import type { NotificationPreferences } from "@leaseplace/domain";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { Input } from "@leaseplace/ui/input";
import { Label } from "@leaseplace/ui/label";
import type { PreferencesResult } from "@/lib/notifications/data";

/** Canaux de notification : e-mail, SMS et WhatsApp (mobile marocain). */
export function PreferencesForm({
  initial,
  action,
}: {
  initial: NotificationPreferences;
  action: (input: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    phone: string;
  }) => Promise<PreferencesResult>;
}) {
  const t = useTranslations("notifications.preferences");
  const id = useId();
  const [p, setP] = useState({ ...initial, phone: initial.phone ?? "" });
  const [result, setResult] = useState<PreferencesResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      data-preferences
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setResult(await action(p));
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-medium text-fg">{t("channels")}</legend>
        {(["email", "sms", "whatsapp"] as const).map((c) => (
          <label key={c} className="flex items-start gap-2 text-[14px] text-fg">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--lp-primary)]"
              checked={p[c]}
              onChange={(e) => {
                setP({ ...p, [c]: e.target.checked });
              }}
            />
            <span>
              {t(`channel.${c}`)}
              <span className="block text-[12px] text-fg-subtle">{t(`hint.${c}`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex max-w-sm flex-col gap-1.5">
        <Label htmlFor={`${id}-phone`}>{t("phone")}</Label>
        <Input
          id={`${id}-phone`}
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder="06 12 34 56 78"
          value={p.phone}
          onChange={(e) => {
            setP({ ...p, phone: e.target.value });
          }}
        />
        <p className="text-xs text-fg-subtle">{t("phoneHint")}</p>
      </div>
      {result?.status === "invalid" ? (
        <Alert tone="danger" role="alert">
          {result.issues.map((i) => t(`issues.${i}`)).join(" ")}
        </Alert>
      ) : null}
      {result?.status === "saved" ? (
        <Alert tone="success" role="status">
          {t("saved")}
        </Alert>
      ) : null}
      <Button type="submit" className="self-start" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
