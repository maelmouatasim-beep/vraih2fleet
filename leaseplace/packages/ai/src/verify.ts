import { EMPTY_FIELDS, type ExtractedFields, type FieldSource } from "@leaseplace/domain";
import type { MemoFacts } from "./facts";
import { MEMO_SECTIONS, type ExtractionOutput, type MemoOutput, type MemoSection } from "./schemas";

// ── Extraction : normalisation prudente ────────────────────────────────────

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isoOrNull(value: string | null): string | null {
  if (value === null) return null;
  const v = value.trim();
  // Date réelle seulement (le 30 février est refusé, pas reporté au 2 mars).
  if (!ISO_DATE.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v) ? v : null;
}

function textOrNull(value: string | null): string | null {
  const v = value?.trim() ?? "";
  return v === "" ? null : v.slice(0, 300);
}

const finiteOrNull = (v: number | null) => (v !== null && Number.isFinite(v) ? v : null);

export interface NormalizedExtraction {
  readable: boolean;
  matchesDeclaredType: boolean;
  fields: ExtractedFields;
  sources: FieldSource[];
  warnings: string[];
}

/** Sortie du modèle → champs du domaine. Une valeur mal formée devient `null`, signalée. */
export function normalizeExtraction(output: ExtractionOutput): NormalizedExtraction {
  const f = output.fields;
  const warnings = [...output.warnings];
  const date = (key: "issuedOn" | "expiresOn") => {
    const v = isoOrNull(f[key]);
    if (f[key] !== null && v === null)
      warnings.push(`Date illisible ignorée (${key}) : ${f[key] ?? ""}`);
    return v;
  };
  const ice = f.ice === null ? null : f.ice.replace(/\D/g, "");
  const fields: ExtractedFields = {
    ...EMPTY_FIELDS,
    legalName: textOrNull(f.legalName),
    ice: ice === null || ice === "" ? null : ice,
    rcNumber: textOrNull(f.rcNumber),
    rcCourt: textOrNull(f.rcCourt),
    taxId: textOrNull(f.taxId),
    cnssNumber: textOrNull(f.cnssNumber),
    legalForm: textOrNull(f.legalForm),
    directors: f.directors
      .map((d) => d.trim())
      .filter((d) => d !== "")
      .slice(0, 10),
    holderName: textOrNull(f.holderName),
    issuedOn: date("issuedOn"),
    expiresOn: date("expiresOn"),
    fiscalYears: f.fiscalYears.filter(
      (y) =>
        y.year >= 1990 &&
        y.year <= 2100 &&
        [y.revenue, y.netIncome, y.depreciation, y.equity, y.financialDebt, y.cash].every(
          Number.isFinite,
        ),
    ),
    averageMonthlyBalance: finiteOrNull(f.averageMonthlyBalance),
    paymentIncidents: finiteOrNull(f.paymentIncidents),
    quoteAmountHt: finiteOrNull(f.quoteAmountHt),
    supplierName: textOrNull(f.supplierName),
  };
  return {
    readable: output.readable,
    matchesDeclaredType: output.matchesDeclaredType,
    fields,
    sources: output.sources.map((s) => ({ ...s, excerpt: s.excerpt.slice(0, 200) })),
    warnings,
  };
}

// ── Note de synthèse : chaque affirmation sourcée, chaque nombre vérifié ───

export const MEMO_ISSUE_CODES = [
  "missing_section",
  "duplicate_section",
  "empty_paragraph",
  "no_source",
  "unknown_source",
  "unverified_number",
] as const;
export type MemoIssueCode = (typeof MEMO_ISSUE_CODES)[number];

export interface MemoIssue {
  code: MemoIssueCode;
  section: MemoSection | null;
  detail: string;
}

/** Petits entiers admis sans source numérique (dénombrements : « deux exercices »). */
export const FREE_INTEGER_MAX = 12;

function collectNumbers(value: unknown, out: number[]): void {
  if (typeof value === "number" && Number.isFinite(value)) out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectNumbers(v, out);
  else if (value !== null && typeof value === "object")
    for (const v of Object.values(value)) collectNumbers(v, out);
}

/** Textes des faits qui contiennent des chiffres. */
function collectDigitStrings(value: unknown, out: Set<string>): void {
  if (typeof value === "string" && /\d/.test(value)) out.add(value);
  else if (Array.isArray(value)) for (const v of value) collectDigitStrings(v, out);
  else if (value !== null && typeof value === "object")
    for (const v of Object.values(value)) collectDigitStrings(v, out);
}

/** Valeurs qu'un texte peut citer : les faits, et leurs écritures usuelles (%, millions). */
export function allowedNumbers(facts: MemoFacts): number[] {
  const raw: number[] = [];
  collectNumbers(facts, raw);
  const out = new Set<number>();
  for (const v of raw) {
    for (const candidate of [v, v * 100, v / 1_000_000, v / 1000, v / 12]) {
      for (const d of [0, 1, 2]) out.add(Math.round(candidate * 10 ** d) / 10 ** d);
      out.add(candidate);
    }
  }
  return [...out];
}

const NUMBER_TOKEN = /\d{1,3}(?:[\u00a0\u202f ]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g;

export function numbersInText(text: string): number[] {
  return [...text.matchAll(NUMBER_TOKEN)].map((m) =>
    Number(m[0].replace(/[\u00a0\u202f ]/g, "").replace(",", ".")),
  );
}

function matches(n: number, allowed: readonly number[]): boolean {
  if (Number.isInteger(n) && n >= 0 && n <= FREE_INTEGER_MAX) return true;
  return allowed.some((a) =>
    Math.abs(a) >= 1000 ? Math.abs(n - a) <= Math.abs(a) * 0.001 : Math.abs(n - a) < 0.051,
  );
}

export function verifyMemo(
  output: MemoOutput,
  facts: MemoFacts,
  sourceIds: readonly string[],
): MemoIssue[] {
  const issues: MemoIssue[] = [];
  const allowed = allowedNumbers(facts);
  // Les chiffres écrits dans un texte des faits (date, raison sociale « Atlas 2000 »,
  // description « tracteur 460 ch ») sont aussi des faits.
  const strings = new Set<string>();
  collectDigitStrings(facts, strings);
  for (const value of strings) allowed.push(...numbersInText(value));
  const known = new Set(sourceIds);
  for (const key of MEMO_SECTIONS) {
    const count = output.sections.filter((s) => s.key === key).length;
    if (count === 0) issues.push({ code: "missing_section", section: key, detail: key });
    if (count > 1) issues.push({ code: "duplicate_section", section: key, detail: key });
  }
  for (const section of output.sections) {
    for (const p of section.paragraphs) {
      if (p.text.trim() === "") {
        issues.push({ code: "empty_paragraph", section: section.key, detail: "" });
        continue;
      }
      if (p.sources.length === 0)
        issues.push({ code: "no_source", section: section.key, detail: p.text.slice(0, 80) });
      for (const s of p.sources)
        if (!known.has(s)) issues.push({ code: "unknown_source", section: section.key, detail: s });
      for (const n of numbersInText(p.text))
        if (!matches(n, allowed))
          issues.push({ code: "unverified_number", section: section.key, detail: String(n) });
    }
  }
  return issues;
}
