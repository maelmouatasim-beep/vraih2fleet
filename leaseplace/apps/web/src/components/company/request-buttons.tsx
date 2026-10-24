"use client";

import { Plus, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { useRouter } from "@/i18n/navigation";

/** Crée un brouillon puis ouvre l'assistant de demande. */
export function NewRequestButton({
  action,
  size,
}: {
  action: () => Promise<string>;
  size?: "sm" | "lg";
}) {
  const t = useTranslations("company.requests");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size={size}
      disabled={pending}
      onClick={() => {
        start(async () => {
          const id = await action();
          router.push(`/entreprise/demandes/${id}`);
        });
      }}
    >
      <Plus aria-hidden="true" />
      {pending ? t("creating") : t("new")}
    </Button>
  );
}

export function CancelRequestButton({
  action,
  requestId,
}: {
  action: (id: string) => Promise<boolean>;
  requestId: string;
}) {
  const t = useTranslations("company.requests");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(t("cancelConfirm"))) return;
          start(async () => {
            const ok = await action(requestId);
            setFailed(!ok);
            router.refresh();
          });
        }}
      >
        <XCircle aria-hidden="true" />
        {t("cancel")}
      </Button>
      {failed ? (
        <Alert tone="danger" role="alert">
          {t("cancelFailed")}
        </Alert>
      ) : null}
    </div>
  );
}
