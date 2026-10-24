"use client";

import { CheckCircle2, ShieldAlert, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useRef } from "react";
import { DOCUMENT_TYPES, MAX_AGE_MONTHS, type DocumentType } from "@leaseplace/domain";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { Input } from "@leaseplace/ui/input";
import { useRouter } from "@/i18n/navigation";
import type { UploadResult } from "@/lib/company-actions";
import { FormField, Select } from "./fields";

type Action = (prev: UploadResult | null, formData: FormData) => Promise<UploadResult>;

/** Dépôt d'un document : type imposé ou au choix, date de délivrance si la fraîcheur compte. */
export function UploadForm({
  action,
  type,
  requestId,
  onDone,
}: {
  action: Action;
  type?: DocumentType;
  requestId?: string;
  onDone?: () => void;
}) {
  const t = useTranslations("company.vault");
  const tl = useTranslations("company.labels");
  const router = useRouter();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.status === "success") {
      formRef.current?.reset();
      // Dans la liste des pièces exigées : on replie la ligne une fois déposée.
      formRef.current?.closest("details")?.removeAttribute("open");
      router.refresh();
      onDone?.();
    }
  }, [state, router, onDone]);

  const needsDate = (k: DocumentType | undefined) =>
    k !== undefined && MAX_AGE_MONTHS[k] !== undefined;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {requestId ? <input type="hidden" name="requestId" value={requestId} /> : null}
      {type ? (
        <input type="hidden" name="type" value={type} />
      ) : (
        <FormField id={`${id}-type`} label={t("type")}>
          <Select id={`${id}-type`} name="type" defaultValue="other">
            {DOCUMENT_TYPES.map((k) => (
              <option key={k} value={k}>
                {tl(`documentTypes.${k}`)}
              </option>
            ))}
          </Select>
        </FormField>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <FormField id={`${id}-file`} label={t("file")} hint={t("fileHint")} className="flex-1">
          <Input
            id={`${id}-file`}
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            required
            className="h-auto py-1.5"
          />
        </FormField>
        {!type || needsDate(type) ? (
          <FormField id={`${id}-issued`} label={t("issuedOn")} className="sm:w-44">
            <Input id={`${id}-issued`} name="issuedOn" type="date" dir="ltr" />
          </FormField>
        ) : null}
      </div>
      {state?.status === "error" ? (
        <Alert tone="danger" role="alert">
          {t(`errors.${state.error}`)}
        </Alert>
      ) : null}
      {state?.status === "success" && state.quarantined ? (
        <Alert tone="danger" role="alert">
          <ShieldAlert aria-hidden="true" />
          <span>{t("quarantined")}</span>
        </Alert>
      ) : null}
      {state?.status === "success" && !state.quarantined ? (
        <Alert tone="success">
          <CheckCircle2 aria-hidden="true" />
          <span>{t("uploaded")}</span>
        </Alert>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        <Upload aria-hidden="true" />
        {pending ? t("uploading") : t("upload")}
      </Button>
    </form>
  );
}
