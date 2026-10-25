import { z } from "zod";

/**
 * Sorties structurées attendues du modèle. Validées par Zod : une sortie
 * non conforme est rejetée et tracée, jamais corrigée en silence.
 */
export const EXTRACTION_FIELD_KEYS = [
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
  "fiscalYears",
  "averageMonthlyBalance",
  "paymentIncidents",
  "quoteAmountHt",
  "supplierName",
] as const;

const fiscalYear = z.object({
  year: z.number().int(),
  revenue: z.number(),
  netIncome: z.number(),
  depreciation: z.number(),
  equity: z.number(),
  financialDebt: z.number(),
  cash: z.number(),
});

export const extractionOutputSchema = z.object({
  readable: z.boolean(),
  matchesDeclaredType: z.boolean(),
  fields: z.object({
    legalName: z.string().nullable(),
    ice: z.string().nullable(),
    rcNumber: z.string().nullable(),
    rcCourt: z.string().nullable(),
    taxId: z.string().nullable(),
    cnssNumber: z.string().nullable(),
    legalForm: z.string().nullable(),
    directors: z.array(z.string()),
    holderName: z.string().nullable(),
    issuedOn: z.string().nullable(),
    expiresOn: z.string().nullable(),
    fiscalYears: z.array(fiscalYear),
    averageMonthlyBalance: z.number().nullable(),
    paymentIncidents: z.number().nullable(),
    quoteAmountHt: z.number().nullable(),
    supplierName: z.string().nullable(),
  }),
  sources: z.array(
    z.object({
      field: z.enum(EXTRACTION_FIELD_KEYS),
      page: z.number().int().nullable(),
      excerpt: z.string(),
    }),
  ),
  warnings: z.array(z.string()),
});
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;

export const MEMO_SECTIONS = [
  "presentation",
  "need",
  "financials",
  "strengths",
  "risks",
  "documents",
] as const;
export type MemoSection = (typeof MEMO_SECTIONS)[number];

export const memoOutputSchema = z.object({
  sections: z.array(
    z.object({
      key: z.enum(MEMO_SECTIONS),
      paragraphs: z.array(
        z.object({
          text: z.string(),
          sources: z.array(z.string()),
        }),
      ),
    }),
  ),
});
export type MemoOutput = z.infer<typeof memoOutputSchema>;
