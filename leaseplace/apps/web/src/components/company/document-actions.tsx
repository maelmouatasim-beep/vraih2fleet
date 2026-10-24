"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@leaseplace/ui/button";
import { useRouter } from "@/i18n/navigation";

export function DeleteDocumentButton({
  action,
  documentId,
  name,
}: {
  action: (id: string) => Promise<{ ok: boolean; error?: "in_use" }>;
  documentId: string;
  name: string;
}) {
  const t = useTranslations("company.vault");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={t("deleteLabel", { name })}
        onClick={() => {
          if (!window.confirm(t("deleteConfirm", { name }))) return;
          start(async () => {
            const r = await action(documentId);
            if (!r.ok) setError(t(r.error === "in_use" ? "errors.in_use" : "errors.generic"));
            router.refresh();
          });
        }}
      >
        <Trash2 aria-hidden="true" />
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
