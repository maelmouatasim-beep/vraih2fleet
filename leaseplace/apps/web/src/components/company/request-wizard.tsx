"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  CloudCheck,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  EQUIPMENT_CATEGORIES,
  ISSUE_STEP,
  REQUEST_LIMITS,
  submissionIssues,
  WIZARD_STEPS,
  type RequestDraft,
  type RequirementState,
  type SubmissionIssue,
  type WizardStep,
} from "@leaseplace/domain";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { Card } from "@leaseplace/ui/card";
import { cn } from "@leaseplace/ui/cn";
import { Input } from "@leaseplace/ui/input";
import { Segmented } from "@leaseplace/ui/segmented";
import { Slider } from "@leaseplace/ui/slider";
import type { DraftPatch, SaveResult, SubmitResult, UploadResult } from "@/lib/company-actions";
import { Link, useRouter } from "@/i18n/navigation";
import { formatMad, formatNumber, formatPercent, ltr, parseAmount } from "@/lib/format";
import { DEFAULTS, simulate } from "@/lib/simulator";
import { FormField } from "./fields";
import { UploadForm } from "./upload-form";

export interface WizardProps {
  /** Motif de la plateforme quand des compléments sont demandés. */
  infoNote?: string | null;
  request: { id: string; reference: string; version: number; draft: RequestDraft };
  quotes: { id: string; name: string }[];
  kyc: { items: { type: string; state: RequirementState }[]; complete: boolean };
  canConsent: boolean;
  consentText: string;
  actions: {
    save: (id: string, version: number, patch: DraftPatch) => Promise<SaveResult>;
    submit: (id: string, consent: boolean, locale: string) => Promise<SubmitResult>;
    upload: (prev: UploadResult | null, formData: FormData) => Promise<UploadResult>;
    detach: (requestId: string, documentId: string) => Promise<void>;
  };
}

type SaveState = "idle" | "saving" | "saved" | "conflict" | "error";

function StepNav({
  step,
  setStep,
  done,
}: {
  step: number;
  setStep: (i: number) => void;
  done: (s: WizardStep) => boolean;
}) {
  const t = useTranslations("company.wizard");
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label={t("stepsLabel")}>
      {WIZARD_STEPS.map((s, i) => (
        <li key={s}>
          <button
            type="button"
            onClick={() => {
              setStep(i);
            }}
            aria-current={i === step ? "step" : undefined}
            className="group flex w-full flex-col gap-1.5 text-start"
          >
            <span
              className={cn(
                "h-1 rounded-full transition-colors",
                i === step ? "bg-primary" : done(s) ? "bg-primary/40" : "bg-surface-sunken",
              )}
            />
            <span
              className={cn(
                "sr-only items-center gap-1 text-[12px] sm:not-sr-only sm:flex",
                i === step ? "font-medium text-fg" : "text-fg-muted",
              )}
            >
              {done(s) && i !== step ? (
                <Check className="size-3 text-primary" aria-hidden="true" />
              ) : null}
              {t(`steps.${s}`)}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function AmountInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="decimal"
        dir="ltr"
        className="tabular pe-16 text-end font-medium"
        value={draft ?? (typeof value === "number" ? formatNumber(value) : "")}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={() => {
          if (draft !== null) onChange(draft.trim() === "" ? null : parseAmount(draft));
          setDraft(null);
        }}
      />
      <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[13px] text-fg-subtle">
        DH HT
      </span>
    </div>
  );
}

export function RequestWizard({
  infoNote,
  request,
  quotes,
  kyc,
  canConsent,
  consentText,
  actions,
}: WizardProps) {
  const t = useTranslations("company.wizard");
  const tl = useTranslations("company.labels");
  const tv = useTranslations("company.vault");
  const locale = useLocale();
  const router = useRouter();
  const [draft, setDraft] = useState<RequestDraft>(request.draft);
  const [version, setVersion] = useState(request.version);
  const [save, setSave] = useState<SaveState>("idle");
  const [consent, setConsent] = useState(false);
  const [serverIssues, setServerIssues] = useState<SubmissionIssue[] | null>(null);
  const [submitting, startSubmit] = useTransition();
  const firstRender = useRef(true);
  const versionRef = useRef(version);
  versionRef.current = version;

  const issues = useMemo(
    () =>
      submissionIssues(draft, {
        hasQuote: quotes.length > 0,
        kycComplete: kyc.complete,
        consentGiven: consent,
        now: new Date(),
      }),
    [draft, quotes.length, kyc.complete, consent],
  );
  const [step, setStep] = useState(() => {
    const first = WIZARD_STEPS.findIndex((s) =>
      issues.some((i) => ISSUE_STEP[i] === s && i !== "consent_missing"),
    );
    return first === -1 ? WIZARD_STEPS.indexOf("consent") : first;
  });
  // « Vérification » n'est faite que lorsque tout le reste l'est.
  const done = (s: WizardStep) =>
    s === "review" ? issues.length === 0 : !issues.some((i) => ISSUE_STEP[i] === s);

  // Sauvegarde automatique (700 ms après la dernière modification).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSave("saving");
    const timer = window.setTimeout(() => {
      void actions.save(request.id, versionRef.current, draft).then((r) => {
        if (r.status === "saved") {
          setVersion(r.version);
          setSave("saved");
        } else setSave(r.status === "conflict" ? "conflict" : "error");
      });
    }, 700);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, actions, request.id]);

  const set = <K extends keyof RequestDraft>(key: K, value: RequestDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const estimate = useMemo(() => {
    if (
      !draft.amountHt ||
      !draft.durationMonths ||
      !draft.periodicity ||
      draft.periodicity === "annual"
    )
      return null;
    const r = simulate({
      ...DEFAULTS,
      amount: draft.amountHt,
      months: draft.durationMonths,
      periodicity: draft.periodicity,
      firstRentPct: draft.firstRentPct ?? 0,
      residualPct: draft.residualPct ?? 0,
    });
    return r.ok ? r : null;
  }, [draft]);

  const submit = () => {
    startSubmit(async () => {
      const r = await actions.submit(request.id, consent, locale);
      if (r.status === "submitted") {
        router.refresh();
        return;
      }
      setServerIssues(r.status === "blocked" ? r.issues : []);
    });
  };

  const stepName = WIZARD_STEPS[step] ?? "equipment";
  const L = REQUEST_LIMITS;

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="tabular font-mono text-[12px] text-fg-subtle">{request.reference}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{t("title")}</h1>
        </div>
        <p
          className="flex items-center gap-1.5 text-[12px] text-fg-muted"
          aria-live="polite"
          data-save-state={save}
        >
          {save === "saving" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          {save === "saved" ? (
            <CloudCheck className="size-3.5 text-success" aria-hidden="true" />
          ) : null}
          {save === "idle" ? null : t(`save.${save}`)}
        </p>
      </div>

      {infoNote ? (
        <Alert tone="warning" role="status" data-info-note>
          <AlertTriangle aria-hidden="true" />
          <div>
            <p className="font-medium">{t("infoRequested")}</p>
            <p className="mt-0.5">{infoNote}</p>
          </div>
        </Alert>
      ) : null}

      {save === "conflict" ? (
        <Alert tone="warning" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span className="flex-1">{t("conflict")}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              window.location.reload();
            }}
          >
            <RefreshCw aria-hidden="true" />
            {t("reload")}
          </Button>
        </Alert>
      ) : null}

      <StepNav step={step} setStep={setStep} done={done} />

      <Card className="p-5 md:p-6">
        <h2 className="mb-5 text-[17px] font-semibold text-fg">{t(`steps.${stepName}`)}</h2>

        {stepName === "equipment" ? (
          <div className="flex flex-col gap-5">
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-fg">{t("category")}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {EQUIPMENT_CATEGORIES.map((c) => (
                  <label key={c} className="relative">
                    <input
                      type="radio"
                      name="category"
                      value={c}
                      checked={draft.equipmentCategory === c}
                      onChange={() => {
                        set("equipmentCategory", c);
                      }}
                      className="peer sr-only"
                    />
                    <span className="flex h-full cursor-pointer items-center rounded-md border border-border bg-surface px-3 py-2.5 text-[13px] text-fg transition-colors peer-checked:border-primary peer-checked:bg-primary-soft/50 peer-checked:font-medium peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:border-border-strong">
                      {tl(`equipmentCategories.${c}`)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <FormField
              id="description"
              label={t("description")}
              hint={t("descriptionHint", { min: L.descriptionLength.min })}
            >
              <textarea
                id="description"
                rows={3}
                maxLength={L.descriptionLength.max}
                value={draft.equipmentDescription ?? ""}
                onChange={(e) => {
                  set("equipmentDescription", e.target.value);
                }}
                className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg shadow-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
              />
            </FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="condition" label={t("condition")}>
                <Segmented
                  label={t("condition")}
                  value={draft.condition ?? "new"}
                  onChange={(v) => {
                    set("condition", v);
                  }}
                  options={[
                    { value: "new", label: tl("conditions.new") },
                    { value: "used", label: tl("conditions.used") },
                  ]}
                />
              </FormField>
              {draft.condition === "used" ? (
                <FormField id="year" label={t("year")}>
                  <Input
                    id="year"
                    type="number"
                    inputMode="numeric"
                    dir="ltr"
                    min={L.equipmentYear.min}
                    value={draft.equipmentYear ?? ""}
                    onChange={(e) => {
                      set("equipmentYear", e.target.value ? Number(e.target.value) : null);
                    }}
                  />
                </FormField>
              ) : null}
            </div>
            <FormField id="supplier" label={t("supplier")} hint={t("supplierHint")}>
              <Input
                id="supplier"
                maxLength={200}
                value={draft.supplierName ?? ""}
                onChange={(e) => {
                  set("supplierName", e.target.value);
                }}
              />
            </FormField>
          </div>
        ) : null}

        {stepName === "financing" ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="flex flex-col gap-5">
              <FormField
                id="amount"
                label={t("amount")}
                hint={t("amountHint", {
                  min: ltr(formatMad(L.amountHt.min, 0)),
                  max: ltr(formatMad(L.amountHt.max, 0)),
                })}
              >
                <AmountInput
                  id="amount"
                  value={draft.amountHt}
                  onChange={(v) => {
                    set("amountHt", v);
                  }}
                />
              </FormField>
              <FormField id="periodicity" label={t("periodicity")}>
                <Segmented
                  label={t("periodicity")}
                  value={
                    draft.periodicity === "annual" ? "monthly" : (draft.periodicity ?? "monthly")
                  }
                  onChange={(v) => {
                    set("periodicity", v);
                  }}
                  options={[
                    { value: "monthly", label: tl("periodicities.monthly") },
                    { value: "quarterly", label: tl("periodicities.quarterly") },
                    { value: "semiannual", label: tl("periodicities.semiannual") },
                  ]}
                />
              </FormField>
              {(
                [
                  [
                    "durationMonths",
                    t("duration"),
                    L.durationMonths.min,
                    L.durationMonths.max,
                    6,
                    (v: number) => t("months", { n: v }),
                  ],
                  [
                    "firstRentPct",
                    t("firstRent"),
                    L.firstRentPct.min,
                    L.firstRentPct.max,
                    1,
                    (v: number) => ltr(formatPercent(v / 100, 0)),
                  ],
                  [
                    "residualPct",
                    t("residual"),
                    L.residualPct.min,
                    L.residualPct.max,
                    1,
                    (v: number) => ltr(formatPercent(v / 100, 0)),
                  ],
                ] as const
              ).map(([key, label, min, max, stepSize, fmt]) => (
                <div key={key} className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="font-medium text-fg">{label}</span>
                    <span className="tabular text-fg">{fmt(draft[key] ?? min)}</span>
                  </div>
                  <Slider
                    label={label}
                    valueText={fmt(draft[key] ?? min)}
                    min={min}
                    max={max}
                    step={stepSize}
                    value={draft[key] ?? min}
                    onValueChange={(v) => {
                      set(key, v);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="h-fit rounded-lg bg-primary-soft/50 p-4" aria-live="polite">
              <p className="text-[12px] text-fg-muted">{t("estimate")}</p>
              <p className="tabular mt-1 text-[26px] font-semibold tracking-tight text-fg">
                {estimate ? ltr(formatMad(estimate.pricing.rentHt, 0)) : "—"}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-fg-subtle">
                {t("estimateHint", { rate: ltr(formatPercent(DEFAULTS.ratePct / 100)) })}
              </p>
            </div>
          </div>
        ) : null}

        {stepName === "documents" ? (
          <div className="flex flex-col gap-6">
            <section>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[14px] font-semibold text-fg">{t("kycTitle")}</h3>
                <Link
                  href="/entreprise/coffre-fort"
                  className="text-[13px] font-medium text-primary underline-offset-2 hover:underline"
                >
                  {t("openVault")}
                </Link>
              </div>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {kyc.items.map((i) => (
                  <li key={i.type} className="flex items-center gap-2 text-[13px] text-fg">
                    {i.state === "ok" ? (
                      <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                    ) : i.state === "stale" ? (
                      <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
                    ) : (
                      <CircleDashed className="size-4 text-fg-subtle" aria-hidden="true" />
                    )}
                    <span className="flex-1">{tl(`documentTypes.${i.type}`)}</span>
                    <span className="sr-only">{tv(`states.${i.state}`)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="border-t border-border pt-5">
              <h3 className="text-[14px] font-semibold text-fg">{t("quoteTitle")}</h3>
              <p className="mt-1 text-[13px] text-fg-muted">{t("quoteHint")}</p>
              {quotes.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {quotes.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[13px]"
                      data-quote={q.name}
                    >
                      <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                      <span className="flex-1 truncate">{q.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t("detach", { name: q.name })}
                        onClick={() => {
                          void actions.detach(request.id, q.id).then(() => {
                            router.refresh();
                          });
                        }}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4">
                <UploadForm action={actions.upload} type="quote" requestId={request.id} />
              </div>
            </section>
          </div>
        ) : null}

        {stepName === "consent" ? (
          <div className="flex flex-col gap-4">
            <blockquote
              className="rounded-md border border-border bg-surface-muted/60 p-4 text-[14px] leading-relaxed text-fg"
              data-consent-text
            >
              {consentText}
            </blockquote>
            {canConsent ? (
              <label className="flex items-start gap-2.5 text-[14px] text-fg">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                  }}
                  className="mt-1 size-4 accent-[var(--lp-primary)]"
                />
                <span>{t("consentCheckbox")}</span>
              </label>
            ) : (
              <Alert tone="info">{t("ownerOnly")}</Alert>
            )}
            <p className="text-[12px] text-fg-subtle">{t("consentNote")}</p>
          </div>
        ) : null}

        {stepName === "review" ? (
          <div className="flex flex-col gap-5">
            <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
              {(
                [
                  [
                    t("category"),
                    draft.equipmentCategory
                      ? tl(`equipmentCategories.${draft.equipmentCategory}`)
                      : "—",
                  ],
                  [t("condition"), draft.condition ? tl(`conditions.${draft.condition}`) : "—"],
                  [t("amount"), draft.amountHt ? ltr(formatMad(draft.amountHt, 0)) : "—"],
                  [
                    t("duration"),
                    draft.durationMonths ? t("months", { n: draft.durationMonths }) : "—",
                  ],
                  [t("firstRent"), ltr(formatPercent((draft.firstRentPct ?? 0) / 100, 0))],
                  [t("residual"), ltr(formatPercent((draft.residualPct ?? 0) / 100, 0))],
                  [
                    t("periodicity"),
                    draft.periodicity ? tl(`periodicities.${draft.periodicity}`) : "—",
                  ],
                  [t("quoteTitle"), String(quotes.length)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-border pb-2">
                  <dt className="text-fg-muted">{k}</dt>
                  <dd className="tabular text-end font-medium text-fg">{v}</dd>
                </div>
              ))}
            </dl>
            {(serverIssues ?? issues).length > 0 ? (
              <Alert tone="warning" role="alert">
                <AlertTriangle aria-hidden="true" />
                <div>
                  <p className="font-medium">{t("issuesTitle")}</p>
                  <ul className="mt-1 list-disc ps-5">
                    {(serverIssues ?? issues).map((i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className="underline underline-offset-2"
                          onClick={() => {
                            setStep(WIZARD_STEPS.indexOf(ISSUE_STEP[i]));
                          }}
                        >
                          {t(`issues.${i}`)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </Alert>
            ) : (
              <Alert tone="success">
                <CheckCircle2 aria-hidden="true" />
                <span>{t("ready")}</span>
              </Alert>
            )}
            <Button
              size="lg"
              onClick={submit}
              disabled={submitting || issues.length > 0 || !canConsent}
              className="self-start"
            >
              {submitting
                ? t("submitting")
                : t(infoNote === undefined || infoNote === null ? "submit" : "resubmit")}
            </Button>
          </div>
        ) : null}
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/90 backdrop-blur md:static md:border-0 md:bg-transparent">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-0 md:py-0">
          <Button
            variant="ghost"
            disabled={step === 0}
            onClick={() => {
              setStep((s) => Math.max(0, s - 1));
            }}
          >
            <ArrowLeft className="rtl:rotate-180" aria-hidden="true" />
            {t("previous")}
          </Button>
          {step < WIZARD_STEPS.length - 1 ? (
            <Button
              onClick={() => {
                setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1));
              }}
            >
              {t("next")}
              <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
