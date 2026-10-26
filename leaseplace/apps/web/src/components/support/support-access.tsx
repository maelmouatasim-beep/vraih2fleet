"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { IMPERSONATION_REASON_MIN } from "@leaseplace/domain";
import { Button } from "@leaseplace/ui/button";
import { Input } from "@leaseplace/ui/input";
import { Label } from "@leaseplace/ui/label";
import type { SupportResult } from "@/lib/support/actions";

/** Ouvrir un accès support : motif obligatoire, puis l'espace du client en lecture seule. */
export function SupportAccess({
  userId,
  organizationId,
  homeHref,
  start,
}: {
  userId: string;
  organizationId: string;
  /** Accueil du compte cible (chemin localisé). */
  homeHref: string;
  start: (userId: string, organizationId: string, reason: string) => Promise<SupportResult>;
}) {
  const t = useTranslations("support");
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<SupportResult | null>(null);
  const [pending, run] = useTransition();
  if (!open)
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setOpen(true);
        }}
      >
        {t("start")}
      </Button>
    );
  return (
    <div className="flex flex-col items-end gap-1.5" data-support-access>
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${uid}-reason`} className="text-xs">
            {t("reason")}
          </Label>
          <Input
            id={`${uid}-reason`}
            className="w-72"
            value={reason}
            minLength={IMPERSONATION_REASON_MIN}
            onChange={(e) => {
              setReason(e.target.value);
            }}
          />
        </div>
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            run(async () => {
              const r = await start(userId, organizationId, reason);
              setResult(r);
              // Navigation complète : le serveur relit la session avec l'accès ouvert.
              if (r.status === "done") window.location.assign(homeHref);
            });
          }}
        >
          {t("confirm")}
        </Button>
      </div>
      <p className="text-[11px] text-fg-subtle">{t("hint")}</p>
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
    </div>
  );
}
