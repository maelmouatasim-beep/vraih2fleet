"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { BUSINESS_SECTORS, HEADCOUNT_BANDS, LEGAL_FORMS, REVENUE_BANDS } from "@leaseplace/domain";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { Input } from "@leaseplace/ui/input";
import { useRouter } from "@/i18n/navigation";
import type { OnboardingState } from "@/app/[locale]/bienvenue/actions";
import { FormField, Select } from "./fields";

type Action = (prev: OnboardingState, formData: FormData) => Promise<OnboardingState>;

export function OnboardingForm({ action, defaultName }: { action: Action; defaultName: string }) {
  const t = useTranslations("company.onboarding");
  const tl = useTranslations("company.labels");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const bad = (f: string) => state.status === "error" && (state.fields?.includes(f) ?? false);

  useEffect(() => {
    if (state.status === "success") {
      router.replace("/entreprise");
      router.refresh();
    }
  }, [state.status, router]);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormField id="fullName" label={t("fullName")}>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          defaultValue={values.fullName ?? defaultName}
          aria-invalid={bad("fullName")}
        />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="legalName" label={t("legalName")} className="sm:col-span-2">
          <Input
            id="legalName"
            name="legalName"
            autoComplete="organization"
            required
            defaultValue={values.legalName}
            aria-invalid={bad("legalName")}
          />
        </FormField>
        <FormField
          id="ice"
          label={t("ice")}
          hint={t("iceHint")}
          error={
            bad("ice")
              ? t(
                  state.status === "error" && state.error === "ice_taken"
                    ? "iceTaken"
                    : "iceInvalid",
                )
              : null
          }
        >
          <Input
            id="ice"
            name="ice"
            inputMode="numeric"
            dir="ltr"
            required
            defaultValue={values.ice}
            aria-invalid={bad("ice")}
            aria-describedby={bad("ice") ? "ice-erreur" : undefined}
          />
        </FormField>
        <FormField id="legalForm" label={t("legalForm")}>
          <Select
            id="legalForm"
            name="legalForm"
            required
            defaultValue={values.legalForm ?? "sarl"}
          >
            {LEGAL_FORMS.map((f) => (
              <option key={f} value={f}>
                {tl(`legalForms.${f}`)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="sector" label={t("sector")}>
          <Select id="sector" name="sector" required defaultValue={values.sector ?? "transport"}>
            {BUSINESS_SECTORS.map((s) => (
              <option key={s} value={s}>
                {tl(`sectors.${s}`)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="city" label={t("city")}>
          <Input
            id="city"
            name="city"
            autoComplete="address-level2"
            required
            defaultValue={values.city}
            aria-invalid={bad("city")}
          />
        </FormField>
        <FormField
          id="incorporationDate"
          label={t("incorporationDate")}
          hint={t("incorporationHint")}
        >
          <Input
            id="incorporationDate"
            name="incorporationDate"
            type="date"
            dir="ltr"
            defaultValue={values.incorporationDate}
          />
        </FormField>
        <FormField id="revenueBand" label={t("revenueBand")}>
          <Select id="revenueBand" name="revenueBand" defaultValue={values.revenueBand ?? ""}>
            <option value="">{t("notSpecified")}</option>
            {REVENUE_BANDS.map((b) => (
              <option key={b} value={b}>
                {tl(`revenueBands.${b}`)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="headcountBand" label={t("headcountBand")}>
          <Select id="headcountBand" name="headcountBand" defaultValue={values.headcountBand ?? ""}>
            <option value="">{t("notSpecified")}</option>
            {HEADCOUNT_BANDS.map((b) => (
              <option key={b} value={b}>
                {tl(`headcountBands.${b}`)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      {state.status === "error" && state.error !== "ice" && state.error !== "ice_taken" ? (
        <Alert tone="danger" role="alert">
          {t(`errors.${state.error}`)}
        </Alert>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? t("creating") : t("submit")}
      </Button>
    </form>
  );
}
