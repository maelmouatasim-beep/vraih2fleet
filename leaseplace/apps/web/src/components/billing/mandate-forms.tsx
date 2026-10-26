"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ANTI_CIRCUMVENTION_MONTHS, DEFAULT_COMMISSION_GRID, gridIssues } from "@leaseplace/domain";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { Input } from "@leaseplace/ui/input";
import { Label } from "@leaseplace/ui/label";
import { useRouter } from "@/i18n/navigation";
import { parseAmount } from "@/lib/format";
import type { AdminResult, MandateForm } from "@/lib/billing/actions";

function Issues({ result, prefix }: { result: AdminResult | null; prefix: string }) {
  const t = useTranslations("billing");
  if (result?.status === "invalid")
    return (
      <Alert tone="danger" role="alert">
        {result.issues.map((i) => t(`${prefix}.${i}`)).join(" ")}
      </Alert>
    );
  if (result?.status === "forbidden")
    return (
      <Alert tone="danger" role="alert">
        {t("forbidden")}
      </Alert>
    );
  return null;
}

/** Nouvelle version de mandat : version du contrat, signature, clause, grille marginale. */
export function MandateCreateForm({
  lessorId,
  today,
  action,
}: {
  lessorId: string;
  today: string;
  action: (lessorId: string, form: MandateForm) => Promise<AdminResult>;
}) {
  const t = useTranslations("billing.mandate");
  const id = useId();
  const router = useRouter();
  const [version, setVersion] = useState("");
  const [signedOn, setSignedOn] = useState("");
  const [months, setMonths] = useState(String(ANTI_CIRCUMVENTION_MONTHS.default));
  const [note, setNote] = useState("");
  const [tiers, setTiers] = useState(
    DEFAULT_COMMISSION_GRID.map((g) => ({
      from: String(g.from),
      rate: String(g.rate * 100).replace(".", ","),
    })),
  );
  const [result, setResult] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();
  const parsed = tiers.map((x) => ({
    from: parseAmount(x.from) ?? Number.NaN,
    ratePct: parseAmount(x.rate) ?? Number.NaN,
  }));
  const live = gridIssues(parsed.map((p) => ({ from: p.from, rate: p.ratePct / 100 })));
  return (
    <form
      className="flex flex-col gap-4"
      data-mandate-form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await action(lessorId, {
            contractVersion: version,
            signedOn,
            antiCircumventionMonths: Number(months),
            tiers: parsed,
            note,
          });
          setResult(r);
          if (r.status === "done") router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-version`}>{t("version")}</Label>
          <Input
            id={`${id}-version`}
            value={version}
            onChange={(e) => {
              setVersion(e.target.value);
            }}
            placeholder="MANDAT-2026-01"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-signed`}>{t("signedOn")}</Label>
          <Input
            id={`${id}-signed`}
            type="date"
            dir="ltr"
            max={today}
            value={signedOn}
            onChange={(e) => {
              setSignedOn(e.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-months`}>{t("antiCircumvention")}</Label>
          <Input
            id={`${id}-months`}
            inputMode="numeric"
            dir="ltr"
            value={months}
            onChange={(e) => {
              setMonths(e.target.value);
            }}
          />
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-medium text-fg">{t("grid")}</legend>
        <p className="text-xs text-fg-subtle">{t("gridHint")}</p>
        {tiers.map((tier, i) => (
          <div key={i} className="flex items-end gap-2" data-tier={i}>
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor={`${id}-from-${String(i)}`} className="text-xs">
                {t("from")}
              </Label>
              <Input
                id={`${id}-from-${String(i)}`}
                inputMode="decimal"
                dir="ltr"
                className="tabular text-end"
                value={tier.from}
                disabled={i === 0}
                onChange={(e) => {
                  setTiers(tiers.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)));
                }}
              />
            </div>
            <div className="flex w-32 flex-col gap-1">
              <Label htmlFor={`${id}-rate-${String(i)}`} className="text-xs">
                {t("rate")}
              </Label>
              <Input
                id={`${id}-rate-${String(i)}`}
                inputMode="decimal"
                dir="ltr"
                className="tabular text-end"
                value={tier.rate}
                onChange={(e) => {
                  setTiers(tiers.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)));
                }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t("removeTier")}
              disabled={tiers.length === 1}
              onClick={() => {
                setTiers(tiers.filter((_, j) => j !== i));
              }}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => {
            setTiers([...tiers, { from: "", rate: "" }]);
          }}
        >
          <Plus aria-hidden="true" />
          {t("addTier")}
        </Button>
        {live.length > 0 ? (
          <p className="text-xs text-warning" role="status">
            {live.map((i) => t(`gridIssues.${i}`)).join(" ")}
          </p>
        ) : null}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-note`}>{t("note")}</Label>
        <Input
          id={`${id}-note`}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
          }}
        />
      </div>
      <Issues result={result} prefix="mandate.issues" />
      <Button type="submit" className="self-start" disabled={pending || live.length > 0}>
        {t("create")}
      </Button>
    </form>
  );
}

/** Actions d'un mandat selon son statut. */
export function MandateActions({
  id,
  status,
  action,
}: {
  id: string;
  status: string;
  action: (
    id: string,
    event: "activate" | "suspend" | "resume" | "terminate",
  ) => Promise<AdminResult>;
}) {
  const t = useTranslations("billing.mandate");
  const router = useRouter();
  const [result, setResult] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();
  const events: ("activate" | "suspend" | "resume" | "terminate")[] =
    status === "draft"
      ? ["activate", "terminate"]
      : status === "active"
        ? ["suspend", "terminate"]
        : status === "suspended"
          ? ["resume", "terminate"]
          : [];
  if (events.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {events.map((e) => (
          <Button
            key={e}
            size="sm"
            variant={e === "terminate" ? "danger" : e === "activate" ? "primary" : "secondary"}
            disabled={pending}
            onClick={() => {
              start(async () => {
                const r = await action(id, e);
                setResult(r);
                if (r.status === "done") router.refresh();
              });
            }}
          >
            {t(`events.${e}`)}
          </Button>
        ))}
      </div>
      <Issues result={result} prefix="mandate.issues" />
    </div>
  );
}
