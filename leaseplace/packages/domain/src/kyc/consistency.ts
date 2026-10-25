import type { RevenueBand } from "./company";
import { isStale } from "./documents";
import { latestFiscalYears, type DocumentExtraction } from "./extraction";

/**
 * Contrôles de cohérence croisés entre le profil déclaré et les documents
 * extraits. Chaque contrôle dit ce qui était attendu, ce qui a été trouvé et
 * dans quels documents : le relecteur vérifie, il ne croit pas sur parole.
 */
export const CHECK_CODES = [
  "ice_match",
  "rc_match",
  "legal_name_match",
  "director_match",
  "id_document_valid",
  "documents_fresh",
  "revenue_band_match",
  "financials_recent",
  "quote_amount_match",
  "extraction_complete",
] as const;
export type CheckCode = (typeof CHECK_CODES)[number];

export const CHECK_STATUSES = ["pass", "warn", "fail", "not_applicable"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export interface ConsistencyCheck {
  code: CheckCode;
  status: CheckStatus;
  documentIds: string[];
  expected: string | number | null;
  found: (string | number)[];
}

export interface ConsistencyInput {
  now: Date;
  company: {
    ice: string;
    legalName: string;
    rcNumber: string | null;
    revenueBand: RevenueBand | null;
  };
  request: { amountHt: number | null };
  extractions: readonly DocumentExtraction[];
  /** Documents dont l'extraction a échoué ou a été rejetée. */
  failedDocumentIds: readonly string[];
}

const LEGAL_FORM_TOKENS = new Set(["sarl", "au", "sa", "sas", "snc", "ste", "societe", "ei"]);

/** Nom comparable : minuscules, sans accents ni ponctuation ni forme juridique. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t !== "" && !LEGAL_FORM_TOKENS.has(t))
    .join(" ");
}

/** Deux noms de personne désignent la même personne (ordre libre, deux mots communs). */
export function samePerson(a: string, b: string): boolean {
  const ta = new Set(normalizeName(a).split(" ").filter(Boolean));
  const tb = normalizeName(b).split(" ").filter(Boolean);
  const common = tb.filter((t) => ta.has(t)).length;
  return common >= Math.min(2, ta.size, tb.length) && common > 0;
}

/** Bornes des tranches de chiffre d'affaires, en dirhams. */
export const REVENUE_BAND_BOUNDS: Readonly<Record<RevenueBand, readonly [number, number]>> = {
  lt_3m: [0, 3_000_000],
  "3m_10m": [3_000_000, 10_000_000],
  "10m_50m": [10_000_000, 50_000_000],
  "50m_175m": [50_000_000, 175_000_000],
  gt_175m: [175_000_000, Number.POSITIVE_INFINITY],
};

/** Écart toléré entre le montant demandé et le devis : 1 % (au-delà : 10 % = anomalie). */
export const QUOTE_TOLERANCE = { pass: 0.01, warn: 0.1 } as const;

function check(
  code: CheckCode,
  status: CheckStatus,
  documentIds: string[] = [],
  expected: string | number | null = null,
  found: (string | number)[] = [],
): ConsistencyCheck {
  return { code, status, documentIds, expected, found };
}

function identifierCheck(
  code: CheckCode,
  expected: string | null,
  values: { documentId: string; value: string }[],
  normalize: (v: string) => string,
): ConsistencyCheck {
  if (values.length === 0) return check(code, "not_applicable", [], expected);
  const found = [...new Set(values.map((v) => normalize(v.value)))];
  const reference = expected === null ? found[0] : normalize(expected);
  const mismatched = values.filter((v) => normalize(v.value) !== reference);
  return check(
    code,
    mismatched.length === 0 && found.length === 1 ? "pass" : "fail",
    (mismatched.length > 0 ? mismatched : values).map((v) => v.documentId),
    expected,
    found,
  );
}

const digits = (v: string) => v.replace(/\D/g, "");
const compact = (v: string) => v.replace(/\s+/g, "").toUpperCase();

export function consistencyChecks(input: ConsistencyInput): ConsistencyCheck[] {
  const { now, company, request, extractions } = input;
  const valuesOf = (pick: (e: DocumentExtraction) => string | null) =>
    extractions.flatMap((e) => {
      const value = pick(e);
      return value === null || value.trim() === "" ? [] : [{ documentId: e.documentId, value }];
    });

  const checks: ConsistencyCheck[] = [
    identifierCheck(
      "ice_match",
      company.ice,
      valuesOf((e) => e.fields.ice),
      digits,
    ),
    identifierCheck(
      "rc_match",
      company.rcNumber,
      valuesOf((e) => e.fields.rcNumber),
      compact,
    ),
  ];

  // Raison sociale : un écart est signalé, pas bloquant (abréviations, sigles).
  const names = valuesOf((e) => e.fields.legalName);
  const expectedName = normalizeName(company.legalName);
  const otherNames = names.filter((n) => {
    const found = normalizeName(n.value);
    return !(found.includes(expectedName) || expectedName.includes(found));
  });
  checks.push(
    names.length === 0
      ? check("legal_name_match", "not_applicable", [], company.legalName)
      : check(
          "legal_name_match",
          otherNames.length === 0 ? "pass" : "warn",
          (otherNames.length > 0 ? otherNames : names).map((n) => n.documentId),
          company.legalName,
          [...new Set(names.map((n) => n.value))],
        ),
  );

  // Dirigeant : le titulaire de la CIN figure parmi les dirigeants déclarés.
  const directors = extractions.flatMap((e) =>
    e.fields.directors.map((name) => ({ documentId: e.documentId, name })),
  );
  const holders = valuesOf((e) => (e.type === "director_id" ? e.fields.holderName : null));
  if (directors.length === 0 || holders.length === 0) {
    checks.push(check("director_match", "not_applicable"));
  } else {
    const unmatched = holders.filter((h) => !directors.some((d) => samePerson(h.value, d.name)));
    checks.push(
      check(
        "director_match",
        unmatched.length === 0 ? "pass" : "warn",
        [...holders, ...directors].map((x) => x.documentId),
        null,
        [...new Set([...holders.map((h) => h.value), ...directors.map((d) => d.name)])],
      ),
    );
  }

  // Pièce d'identité : en cours de validité.
  const ids = extractions.filter((e) => e.type === "director_id");
  if (ids.length === 0) {
    checks.push(check("id_document_valid", "not_applicable"));
  } else {
    const expired = ids.filter(
      (e) => e.fields.expiresOn !== null && new Date(`${e.fields.expiresOn}T00:00:00Z`) < now,
    );
    const unknown = ids.filter((e) => e.fields.expiresOn === null);
    checks.push(
      check(
        "id_document_valid",
        expired.length > 0 ? "fail" : unknown.length > 0 ? "warn" : "pass",
        (expired.length > 0 ? expired : unknown.length > 0 ? unknown : ids).map(
          (e) => e.documentId,
        ),
        null,
        ids.flatMap((e) => (e.fields.expiresOn === null ? [] : [e.fields.expiresOn])),
      ),
    );
  }

  // Fraîcheur : la date lue dans le document, pas celle déclarée au dépôt.
  const dated = extractions.flatMap((e) =>
    e.fields.issuedOn === null ? [] : [{ e, issuedOn: e.fields.issuedOn }],
  );
  const stale = dated.filter(({ e, issuedOn }) =>
    isStale({ type: e.type, issuedOn: new Date(`${issuedOn}T00:00:00Z`) }, now),
  );
  checks.push(
    dated.length === 0
      ? check("documents_fresh", "not_applicable")
      : check(
          "documents_fresh",
          stale.length === 0 ? "pass" : "warn",
          stale.map(({ e }) => e.documentId),
          null,
          stale.map(({ issuedOn }) => issuedOn),
        ),
  );

  // Chiffre d'affaires du dernier exercice dans la tranche déclarée.
  const years = latestFiscalYears(extractions);
  const latest = years[0];
  if (latest === undefined) {
    checks.push(check("revenue_band_match", "not_applicable"));
    checks.push(check("financials_recent", "not_applicable"));
  } else {
    const docs = extractions
      .filter((e) => e.fields.fiscalYears.length > 0)
      .map((e) => e.documentId);
    if (company.revenueBand === null) {
      checks.push(check("revenue_band_match", "not_applicable", docs, null, [latest.revenue]));
    } else {
      const [min, max] = REVENUE_BAND_BOUNDS[company.revenueBand];
      checks.push(
        check(
          "revenue_band_match",
          latest.revenue >= min && latest.revenue < max ? "pass" : "warn",
          docs,
          company.revenueBand,
          [latest.revenue],
        ),
      );
    }
    checks.push(
      check(
        "financials_recent",
        latest.year >= now.getUTCFullYear() - 2 ? "pass" : "warn",
        docs,
        now.getUTCFullYear() - 2,
        [latest.year],
      ),
    );
  }

  // Devis : même montant HT que la demande.
  const quotes = extractions.flatMap((e) =>
    e.type === "quote" && e.fields.quoteAmountHt !== null
      ? [{ documentId: e.documentId, amount: e.fields.quoteAmountHt }]
      : [],
  );
  const requested = request.amountHt;
  if (quotes.length === 0 || requested === null || requested <= 0) {
    checks.push(check("quote_amount_match", "not_applicable", [], requested));
  } else {
    const best = Math.min(...quotes.map((q) => Math.abs(q.amount - requested) / requested));
    checks.push(
      check(
        "quote_amount_match",
        best <= QUOTE_TOLERANCE.pass ? "pass" : best <= QUOTE_TOLERANCE.warn ? "warn" : "fail",
        quotes.map((q) => q.documentId),
        requested,
        quotes.map((q) => q.amount),
      ),
    );
  }

  checks.push(
    check("extraction_complete", input.failedDocumentIds.length === 0 ? "pass" : "warn", [
      ...input.failedDocumentIds,
    ]),
  );
  return checks;
}

export function checkCounts(checks: readonly ConsistencyCheck[]): Record<CheckStatus, number> {
  const counts: Record<CheckStatus, number> = { pass: 0, warn: 0, fail: 0, not_applicable: 0 };
  for (const c of checks) counts[c.status] += 1;
  return counts;
}
