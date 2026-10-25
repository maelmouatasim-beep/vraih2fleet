import type { FiscalYearFigures } from "@leaseplace/domain";
import type { MemoFacts } from "./facts";
import { EXTRACTION_PROMPT_VERSION } from "./prompts/extraction";
import { MEMO_PROMPT_VERSION } from "./prompts/memo";
import type { AiCallMeta, AiProvider, DemoContext, ExtractionRequest } from "./provider";
import type { ExtractionOutput, MemoOutput } from "./schemas";

/**
 * Simulateur de DÉMONSTRATION (mode démo, CI) : n'ouvre pas le document. Il
 * fabrique des valeurs plausibles à partir du profil déclaré, et ne prouve
 * donc rien ; l'écran le signale. Des marqueurs dans le nom du fichier
 * simulent des anomalies pour les démonstrations et les tests :
 * « autre-ice », « cin-expiree », « illisible », « instruction ».
 */
export const MOCK_MODEL = "simulateur-demo";

const REVENUE_BY_BAND: Readonly<Record<string, number>> = {
  lt_3m: 2_200_000,
  "3m_10m": 6_500_000,
  "10m_50m": 24_000_000,
  "50m_175m": 90_000_000,
  gt_175m: 220_000_000,
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFrom = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
const r0 = (v: number) => Math.round(v);

function fiscalYears(ctx: DemoContext): FiscalYearFigures[] {
  const revenue = REVENUE_BY_BAND[ctx.revenueBand ?? ""] ?? 6_500_000;
  const last = ctx.now.getUTCFullYear() - 1;
  return [last - 1, last].map((year, i) => {
    const rev = i === 0 ? revenue * 0.92 : revenue;
    return {
      year,
      revenue: r0(rev),
      netIncome: r0(rev * 0.08),
      depreciation: r0(rev * 0.05),
      equity: r0(rev * 0.3),
      financialDebt: r0(rev * 0.25),
      cash: r0(rev * 0.07),
    };
  });
}

function rcNumberOf(ctx: DemoContext): string {
  return ctx.rcNumber ?? String(Number(ctx.ice.slice(-6)) || 104_233);
}

const EMPTY: ExtractionOutput["fields"] = {
  legalName: null,
  ice: null,
  rcNumber: null,
  rcCourt: null,
  taxId: null,
  cnssNumber: null,
  legalForm: null,
  directors: [],
  holderName: null,
  issuedOn: null,
  expiresOn: null,
  fiscalYears: [],
  averageMonthlyBalance: null,
  paymentIncidents: null,
  quoteAmountHt: null,
  supplierName: null,
};

export function mockExtraction(request: ExtractionRequest): ExtractionOutput {
  const ctx = request.demo;
  const name = request.fileName.toLowerCase();
  if (name.includes("illisible")) {
    return {
      readable: false,
      matchesDeclaredType: false,
      fields: EMPTY,
      sources: [],
      warnings: ["Document illisible (simulation)."],
    };
  }
  const ice = name.includes("autre-ice") ? "009988776655443" : ctx.ice;
  const recent = iso(daysFrom(ctx.now, -20));
  const by: Partial<Record<ExtractionRequest["type"], Partial<ExtractionOutput["fields"]>>> = {
    rc_extract: {
      legalName: ctx.legalName,
      ice,
      rcNumber: rcNumberOf(ctx),
      rcCourt: `Tribunal de commerce de ${ctx.city}`,
      directors: [ctx.directorName],
      issuedOn: recent,
    },
    ice_certificate: { legalName: ctx.legalName, ice },
    articles: { legalName: ctx.legalName, directors: [ctx.directorName] },
    director_id: {
      holderName: ctx.directorName,
      expiresOn: iso(daysFrom(ctx.now, name.includes("cin-expiree") ? -90 : 4 * 365)),
    },
    appointment_minutes: { legalName: ctx.legalName, directors: [ctx.directorName] },
    auto_entrepreneur_card: { holderName: ctx.directorName, ice, issuedOn: recent },
    tax_returns: { legalName: ctx.legalName, ice, fiscalYears: fiscalYears(ctx) },
    business_plan: { legalName: ctx.legalName },
    bank_statements: {
      averageMonthlyBalance: r0((fiscalYears(ctx)[1]?.cash ?? 0) * 0.6),
      paymentIncidents: 0,
      issuedOn: iso(daysFrom(ctx.now, -15)),
    },
    tax_certificate: { legalName: ctx.legalName, ice, issuedOn: iso(daysFrom(ctx.now, -30)) },
    cnss_certificate: { legalName: ctx.legalName, issuedOn: iso(daysFrom(ctx.now, -30)) },
    quote: {
      quoteAmountHt: ctx.requestAmountHt,
      supplierName: ctx.supplierName ?? "Fournisseur (simulation)",
      issuedOn: recent,
    },
  };
  const fields = { ...EMPTY, ...by[request.type] };
  const sources = (Object.keys(fields) as (keyof typeof fields)[])
    .filter((k) => {
      const v = fields[k];
      return Array.isArray(v) ? v.length > 0 : v !== null;
    })
    .map((field) => ({ field, page: 1, excerpt: "(simulation : document non lu)" }));
  return {
    readable: true,
    matchesDeclaredType: true,
    fields,
    sources,
    warnings: name.includes("instruction")
      ? ["Le document contient un texte qui ressemble à une consigne ; il a été ignoré."]
      : [],
  };
}

// ── Note de synthèse simulée, vérifiable comme une vraie ───────────────────

const LABELS: Readonly<Record<string, string>> = {
  // facteurs
  coverage: "couverture des loyers",
  leverage: "endettement",
  profitability: "rentabilité",
  liquidity: "trésorerie",
  exposure: "poids du financement",
  seniority: "ancienneté",
  sector: "secteur",
  asset: "valeur de revente de l'actif",
  // équipements, état
  light_vehicle: "véhicule léger",
  truck: "poids lourd",
  trailer: "remorque",
  construction_machine: "engin de chantier",
  industrial_machine: "machine industrielle",
  medical: "équipement médical",
  it: "informatique",
  agricultural: "matériel agricole",
  new: "neuf",
  used: "occasion",
  // secteurs
  transport: "transport et logistique",
  construction: "BTP",
  health: "santé",
  industry: "industrie",
  agriculture: "agriculture",
  trade: "commerce",
  services: "services",
  tech: "technologies",
  tourism: "tourisme",
  // contrôles et statuts
  fail: "en échec",
  warn: "à vérifier",
  ice_match: "ICE identique dans les pièces",
  rc_match: "numéro de RC",
  legal_name_match: "raison sociale",
  director_match: "dirigeant",
  id_document_valid: "validité de la pièce d'identité",
  documents_fresh: "fraîcheur des pièces",
  revenue_band_match: "tranche de chiffre d'affaires",
  financials_recent: "ancienneté des exercices",
  quote_amount_match: "montant du devis",
  extraction_complete: "lecture des pièces",
  // drapeaux
  negative_equity: "capitaux propres négatifs",
  negative_caf: "CAF négative",
  coverage_below_one: "loyer non couvert par la CAF",
  consistency_failures: "anomalies de cohérence",
  no_financial_statements: "pas d'états financiers",
  net_loss: "perte nette",
  low_cash: "trésorerie faible",
  high_exposure: "financement élevé au regard du chiffre d'affaires",
  young_company: "entreprise récente",
  revenue_decline: "chiffre d'affaires en baisse",
  old_used_asset: "actif d'occasion ancien",
  stale_financials: "exercices anciens",
  // pièces
  rc_extract: "extrait RC",
  ice_certificate: "attestation ICE",
  articles: "statuts",
  director_id: "CIN du dirigeant",
  appointment_minutes: "PV de nomination",
  auto_entrepreneur_card: "carte d'auto-entrepreneur",
  tax_returns: "bilans",
  business_plan: "prévisionnel",
  bank_statements: "relevés bancaires",
  tax_certificate: "attestation fiscale",
  cnss_certificate: "attestation CNSS",
  quote: "devis",
  // formes juridiques
  sarl: "SARL",
  sarlau: "SARL AU",
  sa: "SA",
  sas: "SAS",
  snc: "SNC",
  ei: "entreprise individuelle",
  auto_entrepreneur: "auto-entrepreneur",
};
const label = (code: string) => LABELS[code] ?? code.replaceAll("_", " ");

const NB = "\u202f";
function amount(v: number): string {
  return `${Math.round(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NB)}${NB}DH`;
}
const decimal = (v: number) => v.toFixed(1).replace(".", ",");
const pct = (v: number) => `${decimal(v * 100)}${NB}%`;

export function mockMemo(facts: MemoFacts): MemoOutput {
  const p = facts.PROFILE;
  const q = facts.REQUEST;
  const s = facts.SCORE;
  const latest = facts.FINANCIALS[0];
  const docIds = facts.DOCUMENTS.map((d) => d.id);
  const failing = facts.CHECKS.filter((c) => c.status === "fail" || c.status === "warn");
  const p1 = (text: string, sources: string[]) => ({ text, sources });
  return {
    sections: [
      {
        key: "presentation",
        paragraphs: [
          p1(
            `${p.legalName} (${label(p.legalForm)}), secteur ${label(p.sector)}, siège à ${p.city}${p.ageYears === null ? "" : `, ${String(p.ageYears)} ans d'existence`}.`,
            ["PROFILE"],
          ),
        ],
      },
      {
        key: "need",
        paragraphs: [
          p1(
            `Financement en crédit-bail d'un équipement (${q.equipmentCategory === null ? "catégorie non précisée" : label(q.equipmentCategory)}, ${q.condition === null ? "état non précisé" : label(q.condition)}) pour ${q.amountHt === null ? "un montant à préciser" : amount(q.amountHt)} HT${q.durationMonths === null ? "" : ` sur ${String(q.durationMonths)} mois`}.`,
            ["REQUEST"],
          ),
        ],
      },
      {
        key: "financials",
        paragraphs: [
          latest === undefined
            ? p1(
                "Aucun exercice clos n'est disponible : l'analyse financière repose sur le prévisionnel.",
                ["SCORE"],
              )
            : p1(
                `Exercice ${String(latest.year)} : chiffre d'affaires de ${amount(latest.revenue)}, résultat net de ${amount(latest.netIncome)}, capacité d'autofinancement de ${amount(latest.caf)}.${s.ratios.rentCoverage === null ? "" : ` La CAF couvre ${decimal(s.ratios.rentCoverage)} fois le loyer annuel de référence.`}`,
                ["FINANCIALS", "SCORE"],
              ),
        ],
      },
      {
        key: "strengths",
        paragraphs: [
          p1(
            `Indice d'orientation ${s.grade} (score ${decimal(s.score)} sur 100, modèle ${s.modelVersion}). Facteurs favorables : ${
              s.factors
                .filter((f) => f.level === "strong")
                .map((f) => label(f.factor))
                .join(", ") || "aucun facteur marquant"
            }.`,
            ["SCORE"],
          ),
        ],
      },
      {
        key: "risks",
        paragraphs: [
          p1(
            s.flags.length === 0
              ? "Aucun drapeau de risque relevé par la grille."
              : `Drapeaux relevés : ${s.flags.map((f) => label(f.code)).join(", ")}.`,
            ["SCORE"],
          ),
          p1(
            failing.length === 0
              ? "Les contrôles de cohérence entre les pièces ne relèvent aucune anomalie."
              : `Contrôles à examiner : ${failing.map((c) => `${label(c.code)} (${label(c.status)})`).join(", ")}.`,
            ["CHECKS"],
          ),
          ...(latest !== undefined && s.ratios.netMargin !== null
            ? [p1(`Marge nette du dernier exercice : ${pct(s.ratios.netMargin)}.`, ["SCORE"])]
            : []),
        ],
      },
      {
        key: "documents",
        paragraphs: [
          p1(
            `Pièces analysées : ${facts.DOCUMENTS.map((d) => `${d.id} (${label(d.type)})`).join(", ") || "aucune"}.`,
            docIds.length > 0 ? docIds : ["CHECKS"],
          ),
        ],
      },
    ],
  };
}

export function createMockProvider(now: () => number = Date.now): AiProvider {
  const meta = (promptVersion: string): AiCallMeta => ({
    provider: "mock",
    model: MOCK_MODEL,
    promptVersion,
    usage: { inputTokens: 0, outputTokens: 0 },
    durationMs: 0,
  });
  return {
    name: "mock",
    real: false,
    extract(request) {
      const started = now();
      return Promise.resolve({
        output: mockExtraction(request),
        meta: { ...meta(EXTRACTION_PROMPT_VERSION), durationMs: now() - started },
      });
    },
    writeMemo(facts) {
      return Promise.resolve({ output: mockMemo(facts), meta: meta(MEMO_PROMPT_VERSION) });
    },
  };
}
