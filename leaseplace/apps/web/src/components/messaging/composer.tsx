"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { contactDetails, MESSAGE_LIMITS } from "@leaseplace/domain";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { Label } from "@leaseplace/ui/label";
import { useRouter } from "@/i18n/navigation";
import type { SendResult } from "@/lib/messaging/actions";

/** Saisie d'un message ; avertissement si des coordonnées sont partagées avant l'acceptation. */
export function MessageComposer({
  threadId,
  warnContacts,
  action,
}: {
  threadId: string;
  warnContacts: boolean;
  action: (threadId: string, body: string) => Promise<SendResult>;
}) {
  const t = useTranslations("messages");
  const id = useId();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);
  const [pending, start] = useTransition();
  const flagged = warnContacts && contactDetails(body).length > 0;
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await action(threadId, body);
          setResult(r);
          if (r.status === "sent") {
            setBody("");
            router.refresh();
          }
        });
      }}
    >
      <Label htmlFor={`${id}-body`}>{t("label")}</Label>
      <textarea
        id={`${id}-body`}
        rows={3}
        maxLength={MESSAGE_LIMITS.max}
        className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg shadow-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
        }}
      />
      {flagged ? (
        <Alert tone="warning" data-contact-warning>
          {t("contactWarning")}
        </Alert>
      ) : null}
      {result?.status === "invalid" ? (
        <p role="alert" className="text-xs text-danger">
          {result.issues.map((i) => t(`issues.${i}`)).join(" ")}
        </p>
      ) : null}
      {result?.status === "forbidden" ? (
        <p role="alert" className="text-xs text-danger">
          {t("forbidden")}
        </p>
      ) : null}
      <Button type="submit" className="self-end" disabled={pending || body.trim() === ""}>
        <Send aria-hidden="true" />
        {pending ? t("sending") : t("send")}
      </Button>
    </form>
  );
}
