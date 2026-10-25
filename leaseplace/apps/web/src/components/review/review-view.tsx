import { AlertTriangle, CheckCircle2, CircleDashed, Download, Flag, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { MemoOutput } from "@leaseplace/ai";
import type {
  ConsistencyCheck,
  ExtractedFields,
  FactorScore,
  Flag as RiskFlag,
} from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";
import { cn } from "@leaseplace/ui/cn";
import { formatDate, formatMad, formatNumber, formatPercent, ltr } from "@/lib/format";

const STATUS_TONE: Record<
  string,
  "neutral" | "info" | "warning" | "success" | "danger" | "primary"
> = {
  draft: "neutral",
  submitted: "info",
  in_review: "primary",
  needs_info: "warning",
  qualified: "success",
  cancelled: "danger",
};

export async function StatusBadge({ status }: { status: string }) {
  const t = await getTranslations("company.requests.statuses");
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{t(status)}</Badge>;
}

const CHECK_ICON = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
  not_applicable: CircleDashed,
} as const;
const CHECK_TONE = {
  pass: "success",
  warn: "warning",
  fail: "danger",
  not_applicable: "neutral",
} as const;

function show(value: string | number | null): string {
  if (value === null) return "—";
  return typeof value === "number" ? ltr(formatNumber(value, value % 1 === 0 ? 0 : 2)) : value;
}

export async function ChecksTable({
  checks,
  docLabel,
}: {
  checks: readonly ConsistencyCheck[];
  docLabel: (id: string) => string;
}) {
  const t = await getTranslations("review.checks");
  if (checks.length === 0) return <p className="text-[13px] text-fg-muted">{t("none")}</p>;
  return (
    <ul className="divide-y divide-border">
      {checks.map((c) => {
        const Icon = CHECK_ICON[c.status];
        return (
          <li key={c.code} className="flex gap-3 py-2.5" data-check={c.code} data-status={c.status}>
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                c.status === "pass"
                  ? "text-success"
                  : c.status === "warn"
                    ? "text-warning"
                    : c.status === "fail"
                      ? "text-danger"
                      : "text-fg-subtle",
              )}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-fg">
                {t(`codes.${c.code}`)}
                <Badge tone={CHECK_TONE[c.status]}>{t(`statuses.${c.status}`)}</Badge>
              </p>
              {c.status !== "pass" && c.status !== "not_applicable" ? (
                <p className="mt-0.5 text-[12px] text-fg-muted">
                  {c.expected !== null ? `${t("expected")} : ${show(c.expected)} · ` : ""}
                  {c.found.length > 0 ? `${t("found")} : ${c.found.map(show).join(", ")}` : ""}
                  {c.documentIds.length > 0 ? ` · ${c.documentIds.map(docLabel).join(", ")}` : ""}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function factorValue(
  f: FactorScore,
  t: (k: string, v?: Record<string, string | number>) => string,
) {
  const v = f.value;
  if (v === null) return "—";
  if (typeof v === "string") return t(f.factor === "sector" ? `sectorRisk.${v}` : `resale.${v}`);
  switch (f.factor) {
    case "coverage":
    case "leverage":
      return ltr(`${formatNumber(v, 2)}×`);
    case "profitability":
    case "exposure":
      return ltr(formatPercent(v, 1));
    case "liquidity":
      return t("monthsValue", { n: formatNumber(v, 1) });
    case "seniority":
      return t("yearsValue", { n: Math.floor(v / 12) });
    default:
      return show(v);
  }
}

const LEVEL_BAR = {
  strong: "bg-success",
  adequate: "bg-primary",
  weak: "bg-danger",
  missing: "bg-surface-sunken",
};

export async function FactorTable({ factors }: { factors: readonly FactorScore[] }) {
  const t = await getTranslations("review.score");
  return (
    <table className="w-full text-[13px]">
      <caption className="sr-only">{t("factorsCaption")}</caption>
      <thead className="text-fg-muted">
        <tr>
          <th scope="col" className="py-1.5 text-start font-medium">
            {t("factor")}
          </th>
          <th scope="col" className="py-1.5 text-end font-medium">
            {t("value")}
          </th>
          <th scope="col" className="py-1.5 ps-3 text-start font-medium">
            {t("points")}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {factors.map((f) => (
          <tr key={f.factor} data-factor={f.factor}>
            <th scope="row" className="py-2 text-start font-normal text-fg">
              {t(`factors.${f.factor}`)}
              <span className="ms-1 text-[11px] text-fg-subtle">({f.weight})</span>
            </th>
            <td className="tabular py-2 text-end whitespace-nowrap text-fg">{factorValue(f, t)}</td>
            <td className="py-2 ps-3">
              <span className="flex items-center gap-2">
                <span
                  className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-sunken"
                  aria-hidden="true"
                >
                  <span
                    className={cn("block h-full rounded-full", LEVEL_BAR[f.level])}
                    style={{ width: `${String(f.score ?? 0)}%` }}
                  />
                </span>
                <span className="tabular text-[12px] text-fg-muted">
                  {f.score === null
                    ? t("levels.missing")
                    : `${String(f.score)} · ${t(`levels.${f.level}`)}`}
                </span>
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export async function FlagList({ flags }: { flags: readonly RiskFlag[] }) {
  const t = await getTranslations("review.score");
  if (flags.length === 0) return <p className="text-[13px] text-fg-muted">{t("noFlags")}</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {flags.map((f) => (
        <li key={f.code} className="flex items-start gap-2 text-[13px]" data-flag={f.code}>
          <Flag
            className={cn(
              "mt-0.5 size-3.5 shrink-0",
              f.severity === "severe" ? "text-danger" : "text-warning",
            )}
            aria-hidden="true"
          />
          <span className="text-fg">
            {t(`flags.${f.code}`)}
            {f.severity === "severe" ? (
              <span className="ms-1.5 text-[11px] font-medium text-danger">{t("severe")}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

const FIELD_ORDER: (keyof ExtractedFields)[] = [
  "legalName",
  "ice",
  "rcNumber",
  "rcCourt",
  "taxId",
  "cnssNumber",
  "legalForm",
  "directors",
  "holderName",
  "issuedOn",
  "expiresOn",
  "averageMonthlyBalance",
  "paymentIncidents",
  "quoteAmountHt",
  "supplierName",
];

export async function ExtractedFieldsView({ fields }: { fields: ExtractedFields }) {
  const t = await getTranslations("review.fields");
  const rows = FIELD_ORDER.flatMap((k) => {
    const v = fields[k];
    if (v === null || (Array.isArray(v) && v.length === 0)) return [];
    let text: string;
    if (Array.isArray(v)) text = (v as string[]).join(", ");
    else if (k === "issuedOn" || k === "expiresOn")
      text = formatDate(new Date(`${String(v)}T00:00:00Z`));
    else if (typeof v === "number")
      text = k === "paymentIncidents" ? String(v) : ltr(formatMad(v, 0));
    else text = v;
    return [[k, text] as const];
  });
  return (
    <div className="flex flex-col gap-2">
      {rows.length > 0 ? (
        <dl className="grid gap-x-4 gap-y-1 text-[12px] sm:grid-cols-[auto_1fr]">
          {rows.map(([k, text]) => (
            <div key={k} className="contents">
              <dt className="text-fg-muted">{t(k)}</dt>
              <dd className="font-medium break-words text-fg">{text}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {fields.fiscalYears.length > 0 ? (
        <table className="w-full text-[12px]">
          <caption className="sr-only">{t("fiscalYears")}</caption>
          <thead className="text-fg-muted">
            <tr>
              <th scope="col" className="py-1 text-start font-medium">
                {t("year")}
              </th>
              <th scope="col" className="py-1 text-end font-medium">
                {t("revenue")}
              </th>
              <th scope="col" className="py-1 text-end font-medium">
                {t("netIncome")}
              </th>
              <th scope="col" className="py-1 text-end font-medium">
                {t("equity")}
              </th>
            </tr>
          </thead>
          <tbody>
            {[...fields.fiscalYears]
              .sort((a, b) => b.year - a.year)
              .map((y) => (
                <tr key={y.year}>
                  <td className="tabular py-1">{y.year}</td>
                  <td className="tabular py-1 text-end">{ltr(formatMad(y.revenue, 0))}</td>
                  <td className="tabular py-1 text-end">{ltr(formatMad(y.netIncome, 0))}</td>
                  <td className="tabular py-1 text-end">{ltr(formatMad(y.equity, 0))}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export async function MemoView({
  content,
  sourceLabel,
}: {
  content: MemoOutput;
  sourceLabel: (id: string) => string;
}) {
  const t = await getTranslations("review.memo");
  return (
    <div className="flex flex-col gap-4" data-memo>
      {content.sections.map((s) => (
        <section key={s.key}>
          <h4 className="text-[12px] font-semibold tracking-wide text-fg-muted uppercase">
            {t(`sections.${s.key}`)}
          </h4>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="mt-1.5 text-[14px] leading-relaxed text-fg">
              {p.text}{" "}
              {p.sources.map((src) => (
                <span
                  key={src}
                  className="ms-1 inline-flex items-center rounded-sm bg-surface-muted px-1 align-baseline font-mono text-[10px] text-fg-muted"
                  title={sourceLabel(src)}
                >
                  {src}
                </span>
              ))}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

export function DownloadLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"
      aria-label={label}
    >
      <Download className="size-4" aria-hidden="true" />
    </a>
  );
}
