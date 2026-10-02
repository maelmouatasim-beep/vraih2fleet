// Lecture de factures et de devis (Phase 5.4) — extraction par Claude,
// VÉRIFIÉE : champs du type de pièce seulement, nombres retrouvés dans le
// texte du document quand il en a un, garage parmi ceux transmis. Rien
// n'est écrit en base ici : l'utilisateur confirme dans l'application.
import { z } from "../_shared/validation.ts";
import {
  CERTITUDES_DOCUMENT,
  promptDocument,
  SCHEMA_EXTRACTION,
  TYPES_DOCUMENT,
  verifierExtraction,
  type ExtractionDocument,
  type TypeDocument,
} from "../_shared/documentSchema.ts";

export const zCorpsDocument = z.object({
  organizationId: z.string().uuid(),
  documentId: z.string().uuid(),
  langue: z.enum(["fr", "en"]).default("fr"),
  /** Couche texte du PDF lue dans le navigateur (minimisation : le
   *  fichier n'est envoyé que s'il n'a pas de texte exploitable). */
  texte: z.string().max(120_000).nullable().default(null),
  garages: z.array(z.string().min(1).max(120)).max(50).default([]),
});
export type CorpsDocument = z.infer<typeof zCorpsDocument>;

/** Texte suffisant pour lire la pièce sans envoyer le fichier. */
export const TEXTE_MINIMUM = 200;

const zReponse = z.object({
  type_detecte: z.enum([...TYPES_DOCUMENT, "autre"]),
  fournisseur: z.string(),
  date_document: z.string(),
  garage_propose: z.string(),
  champs: z.array(
    z.object({
      champ: z.string(),
      valeur_nombre: z.number().nullable(),
      valeur_texte: z.string(),
      extrait: z.string(),
      page: z.number().int().nullable(),
      certitude: z.enum(CERTITUDES_DOCUMENT),
    }),
  ),
});

export interface PieceAnalysee {
  type: TypeDocument;
  /** Fichier en base64 (seulement sans couche texte). */
  fichier: { base64: string; mime: string } | null;
}

export interface DepsDocument {
  appelerClaude: (params: Record<string, unknown>) => Promise<{
    content: Record<string, unknown>[];
    stop_reason: string | null;
    model: string;
    usage: Record<string, number | null | undefined>;
  }>;
  modele: string;
  journaliserUsage: (modele: string, usage: Record<string, number | null | undefined>) => Promise<void>;
}

export type SortieDocument =
  | { type: "extraction"; extraction: ExtractionDocument; rejets: number; mode: "texte" | "fichier" }
  | { type: "refus" }
  | { type: "invalide" };

export function contenuUtilisateur(corps: CorpsDocument, piece: PieceAnalysee): Record<string, unknown>[] {
  const consigne = { type: "text", text: "Extrais les champs de ce document selon les règles." };
  if (corps.texte && corps.texte.trim().length >= TEXTE_MINIMUM) {
    return [{ type: "text", text: `<document>\n${corps.texte}\n</document>` }, consigne];
  }
  if (!piece.fichier) throw new Error("document sans texte ni fichier");
  const bloc =
    piece.fichier.mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: piece.fichier.base64 } }
      : { type: "image", source: { type: "base64", media_type: piece.fichier.mime, data: piece.fichier.base64 } };
  return [bloc, consigne];
}

export async function extraireDocument(corps: CorpsDocument, piece: PieceAnalysee, deps: DepsDocument): Promise<SortieDocument> {
  const modeTexte = !!corps.texte && corps.texte.trim().length >= TEXTE_MINIMUM;
  const reponse = await deps.appelerClaude({
    model: deps.modele,
    max_tokens: 8000,
    system: promptDocument(piece.type, corps.langue, corps.garages),
    messages: [{ role: "user", content: contenuUtilisateur(corps, piece) }],
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA_EXTRACTION } },
    fallbacks: "default",
    betas: ["server-side-fallback-2026-07-01"],
  });
  await deps.journaliserUsage(reponse.model, reponse.usage);
  if (reponse.stop_reason === "refusal") return { type: "refus" };
  const texte = reponse.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(texte);
  } catch {
    return { type: "invalide" };
  }
  const r = zReponse.safeParse(json);
  if (!r.success) return { type: "invalide" };
  const { extraction, rejets } = verifierExtraction(r.data, piece.type, modeTexte ? corps.texte : null, corps.garages);
  return { type: "extraction", extraction, rejets, mode: modeTexte ? "texte" : "fichier" };
}
