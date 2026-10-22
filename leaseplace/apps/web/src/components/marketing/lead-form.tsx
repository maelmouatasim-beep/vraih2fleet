"use client";

import { CheckCircle2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { Input } from "@leaseplace/ui/input";
import { Label } from "@leaseplace/ui/label";
import { Link } from "@/i18n/navigation";
import type { LeadState } from "@/lib/leads";

type Action = (prev: LeadState, formData: FormData) => Promise<LeadState>;

export function LeadForm({ action, kind }: { action: Action; kind: "lessor" | "company" }) {
  const t = useTranslations("lessorsPage.form");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const invalid = (f: string) => state.status === "error" && state.fields?.includes(f);
  const values = state.status === "error" ? (state.values ?? {}) : {};

  if (state.status === "success") {
    return (
      <Alert tone="success" className="p-5">
        <CheckCircle2 aria-hidden="true" />
        <div>
          <p className="font-medium">{t("successTitle")}</p>
          <p className="mt-1 text-fg-muted">{t("successBody")}</p>
        </div>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="locale" value={locale} />
      <div className="absolute -start-[9999px]" aria-hidden="true">
        <label>
          {t("honeypot")}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-org">{t("organization")}</Label>
          <Input
            id="lead-org"
            name="organizationName"
            defaultValue={values.organizationName}
            required
            minLength={2}
            maxLength={200}
            autoComplete="organization"
            aria-invalid={invalid("organizationName")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-name">{t("contactName")}</Label>
          <Input
            id="lead-name"
            name="contactName"
            defaultValue={values.contactName}
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            aria-invalid={invalid("contactName")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-email">{t("email")}</Label>
          <Input
            id="lead-email"
            name="email"
            defaultValue={values.email}
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            aria-invalid={invalid("email")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-phone">{t("phone")}</Label>
          <Input
            id="lead-phone"
            name="phone"
            defaultValue={values.phone}
            type="tel"
            autoComplete="tel"
            dir="ltr"
            maxLength={30}
            aria-invalid={invalid("phone")}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-message">{t("message")}</Label>
        <textarea
          id="lead-message"
          name="message"
          defaultValue={values.message}
          rows={4}
          maxLength={2000}
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg shadow-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
        />
      </div>
      <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-fg-muted">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-1 size-4 accent-[var(--lp-primary)]"
          aria-invalid={invalid("consent")}
        />
        <span>
          {t("consent")}{" "}
          <Link href="/mentions-legales" className="text-primary underline underline-offset-2">
            {t("privacyLink")}
          </Link>
        </span>
      </label>
      {state.status === "error" ? (
        <Alert tone="danger" role="alert">
          {t(`errors.${state.error}`)}
        </Alert>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? t("sending") : t("submit")}
      </Button>
    </form>
  );
}
