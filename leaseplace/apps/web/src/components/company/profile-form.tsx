"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { BUSINESS_SECTORS, HEADCOUNT_BANDS, REVENUE_BANDS } from "@leaseplace/domain";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { Input } from "@leaseplace/ui/input";
import type { ProfileState } from "@/app/[locale]/entreprise/actions";
import { FormField, Select } from "./fields";

type Action = (prev: ProfileState, formData: FormData) => Promise<ProfileState>;

export interface ProfileValues {
  tradeName: string;
  rcNumber: string;
  rcCourt: string;
  taxId: string;
  cnssNumber: string;
  address: string;
  city: string;
  sector: string;
  incorporationDate: string;
  revenueBand: string;
  headcountBand: string;
}

const TEXT_FIELDS = [
  ["tradeName", 200, undefined],
  ["rcNumber", 30, "ltr"],
  ["rcCourt", 100, undefined],
  ["taxId", 30, "ltr"],
  ["cnssNumber", 30, "ltr"],
] as const;

/** Profil de l'entreprise ; en lecture seule pour les collaborateurs. */
export function ProfileForm({
  action,
  values,
  readOnly,
}: {
  action: Action;
  values: ProfileValues;
  readOnly: boolean;
}) {
  const t = useTranslations("company.profile");
  const to = useTranslations("company.onboarding");
  const tl = useTranslations("company.labels");
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const bad = (f: string) => state.status === "error" && (state.fields?.includes(f) ?? false);
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <fieldset disabled={readOnly || pending} className="grid gap-5 sm:grid-cols-2">
        {TEXT_FIELDS.map(([name, max, dir]) => (
          <FormField key={name} id={name} label={t(`fields.${name}`)}>
            <Input
              id={name}
              name={name}
              maxLength={max}
              dir={dir}
              defaultValue={values[name]}
              aria-invalid={bad(name)}
            />
          </FormField>
        ))}
        <FormField id="city" label={to("city")}>
          <Input
            id="city"
            name="city"
            required
            autoComplete="address-level2"
            defaultValue={values.city}
            aria-invalid={bad("city")}
          />
        </FormField>
        <FormField id="address" label={t("fields.address")} className="sm:col-span-2">
          <Input
            id="address"
            name="address"
            maxLength={300}
            autoComplete="street-address"
            defaultValue={values.address}
          />
        </FormField>
        <FormField id="sector" label={to("sector")}>
          <Select id="sector" name="sector" defaultValue={values.sector}>
            {BUSINESS_SECTORS.map((s) => (
              <option key={s} value={s}>
                {tl(`sectors.${s}`)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="incorporationDate" label={to("incorporationDate")}>
          <Input
            id="incorporationDate"
            name="incorporationDate"
            type="date"
            dir="ltr"
            defaultValue={values.incorporationDate}
            aria-invalid={bad("incorporationDate")}
          />
        </FormField>
        <FormField id="revenueBand" label={to("revenueBand")}>
          <Select id="revenueBand" name="revenueBand" defaultValue={values.revenueBand}>
            <option value="">{to("notSpecified")}</option>
            {REVENUE_BANDS.map((b) => (
              <option key={b} value={b}>
                {tl(`revenueBands.${b}`)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="headcountBand" label={to("headcountBand")}>
          <Select id="headcountBand" name="headcountBand" defaultValue={values.headcountBand}>
            <option value="">{to("notSpecified")}</option>
            {HEADCOUNT_BANDS.map((b) => (
              <option key={b} value={b}>
                {tl(`headcountBands.${b}`)}
              </option>
            ))}
          </Select>
        </FormField>
      </fieldset>
      {state.status === "error" ? (
        <Alert tone="danger" role="alert">
          {t("error")}
        </Alert>
      ) : null}
      {state.status === "saved" ? (
        <Alert tone="success" role="status">
          {t("saved")}
        </Alert>
      ) : null}
      {readOnly ? (
        <Alert tone="info">{t("readOnly")}</Alert>
      ) : (
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? t("saving") : t("save")}
        </Button>
      )}
    </form>
  );
}
