import type { DocumentType } from "./documents";

/**
 * Données extraites d'un document (par l'IA ou saisies à la revue). Toutes
 * les valeurs sont facultatives : un champ absent du document reste `null`,
 * jamais deviné. Montants en dirhams, dates au format ISO (AAAA-MM-JJ).
 */
export interface FiscalYearFigures {
  /** Année de clôture de l'exercice. */
  year: number;
  /** Chiffre d'affaires HT. */
  revenue: number;
  netIncome: number;
  /** Dotations d'exploitation aux amortissements et provisions. */
  depreciation: number;
  equity: number;
  /** Dettes de financement et concours bancaires courants. */
  financialDebt: number;
  /** Trésorerie à l'actif. */
  cash: number;
}

export interface ExtractedFields {
  legalName: string | null;
  ice: string | null;
  rcNumber: string | null;
  rcCourt: string | null;
  taxId: string | null;
  cnssNumber: string | null;
  legalForm: string | null;
  /** Dirigeants cités par le document (registre, procès-verbal). */
  directors: string[];
  /** Titulaire d'une pièce d'identité. */
  holderName: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  fiscalYears: FiscalYearFigures[];
  /** Relevés bancaires : solde moyen mensuel et incidents de paiement. */
  averageMonthlyBalance: number | null;
  paymentIncidents: number | null;
  /** Devis : montant HT et fournisseur. */
  quoteAmountHt: number | null;
  supplierName: string | null;
}

export const EMPTY_FIELDS: ExtractedFields = {
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

/** Où une valeur a été lue : page et court extrait du document. */
export interface FieldSource {
  field: keyof ExtractedFields;
  page: number | null;
  excerpt: string;
}

export interface DocumentExtraction {
  documentId: string;
  type: DocumentType;
  fields: ExtractedFields;
}

/** Dernier exercice disponible parmi toutes les liasses extraites. */
export function latestFiscalYears(extractions: readonly DocumentExtraction[]): FiscalYearFigures[] {
  const byYear = new Map<number, FiscalYearFigures>();
  for (const e of extractions) for (const fy of e.fields.fiscalYears) byYear.set(fy.year, fy);
  return [...byYear.values()].sort((a, b) => b.year - a.year);
}
