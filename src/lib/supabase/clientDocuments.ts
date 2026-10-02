/**
 * Phase 5.4 — Pièces justificatives (factures et devis) : dépôt dans le
 * stockage privé (empreinte SHA-256), liste, aperçu (lien signé de
 * courte durée), puis CONFIRMATION : écritures planifiées (avant → après,
 * src/lib/documents/application.ts) exécutées, pièce marquée confirmée
 * et journalisée. Une pièce n'est jamais supprimée.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { TypeDocument } from "../../../supabase/functions/_shared/documentSchema";
import { changementsJournal, type Ecriture } from "@/lib/documents/application";
import { journaliser } from "@/lib/supabase/changeLog";
import { upsertEnergyInputs } from "@/lib/supabase/energyInputs";
import type { PieceJustificative } from "@/lib/journey/report";

export type ClientDocumentRow = Tables<"client_documents">;

export const TYPES_MIME_DOCUMENT = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export const TAILLE_MAX_DOCUMENT = 10 * 1024 * 1024;

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function deposerDocument(params: {
  file: File;
  organizationId: string;
  projectId: string | null;
  kind: TypeDocument;
}): Promise<ClientDocumentRow> {
  const { file, organizationId, projectId, kind } = params;
  if (!(TYPES_MIME_DOCUMENT as readonly string[]).includes(file.type)) throw new Error("format_non_pris_en_charge");
  if (file.size <= 0 || file.size > TAILLE_MAX_DOCUMENT) throw new Error("fichier_trop_volumineux");
  const buffer = await file.arrayBuffer();
  const empreinte = await sha256(buffer);
  const chemin = `${organizationId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const { error: errStockage } = await supabase.storage
    .from("client-documents")
    .upload(chemin, buffer, { contentType: file.type, upsert: false });
  if (errStockage) throw errStockage;
  const { data, error } = await supabase
    .from("client_documents")
    .insert({
      organization_id: organizationId,
      project_id: projectId,
      kind,
      storage_path: chemin,
      file_name: file.name.slice(0, 255) || "document",
      mime_type: file.type,
      size_bytes: file.size,
      sha256: empreinte,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listerDocuments(organizationId: string, projectId?: string | null): Promise<ClientDocumentRow[]> {
  let q = supabase.from("client_documents").select("*").eq("organization_id", organizationId);
  q = projectId ? q.or(`project_id.is.null,project_id.eq.${projectId}`) : q.is("project_id", null);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

/** Lien signé (10 min) pour afficher la pièce à côté des valeurs. */
export async function lienDocument(chemin: string): Promise<string> {
  const { data, error } = await supabase.storage.from("client-documents").createSignedUrl(chemin, 600);
  if (error || !data) throw error ?? new Error("lien_indisponible");
  return data.signedUrl;
}

/** Garde l'extraction (IA) sur la pièce en attente : la revue peut être reprise. */
export async function enregistrerExtraction(id: string, extraction: Json): Promise<void> {
  const { error } = await supabase.from("client_documents").update({ extraction }).eq("id", id).eq("status", "pending");
  if (error) throw error;
}

export async function rejeterDocument(id: string): Promise<void> {
  const { error } = await supabase.from("client_documents").update({ status: "rejected" }).eq("id", id);
  if (error) throw error;
}

/**
 * Confirme une pièce : exécute les écritures planifiées (déjà montrées à
 * l'utilisateur), enregistre valeurs et cibles sur la pièce, journalise.
 */
export async function confirmerDocument(params: {
  document: ClientDocumentRow;
  projectId: string | null;
  ecritures: Ecriture[];
  extraction: Json;
  supplier: string | null;
  documentDate: string | null;
  resume: string;
}): Promise<void> {
  const { document, ecritures } = params;
  // 1. Écritures (chaque cible relie aussi la pièce comme preuve)
  for (const e of ecritures) {
    if (e.table === "energy_client_inputs") {
      await upsertEnergyInputs({
        organization_id: document.organization_id,
        project_id: e.portee === "projet" ? params.projectId : null,
        [e.champ]: e.apres,
        [e.lienDocument]: document.id,
      });
    } else if (e.table === "garages") {
      const patch =
        e.champ === "hq_rate"
          ? { hq_rate: e.apres }
          : e.champ === "grid_connection_quote"
            ? { grid_connection_quote: e.apres, grid_quote_document_id: document.id }
            : { charger_unit_quote: e.devisComplet as unknown as Json, charger_quote_document_id: document.id };
      const { error } = await supabase.from("garages").update(patch).eq("id", e.garageId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("project_vehicles")
        .update({ quote_price: e.apres, quote_technology: e.technologie, quote_document_id: document.id })
        .eq("id", e.projectVehicleId);
      if (error) throw error;
    }
  }
  // 2. Pièce confirmée (datée et signée par la base)
  const changements = changementsJournal(ecritures);
  const { error } = await supabase
    .from("client_documents")
    .update({
      status: "confirmed",
      extraction: params.extraction,
      applied: changements as unknown as Json,
      supplier: params.supplier,
      document_date: params.documentDate,
    })
    .eq("id", document.id);
  if (error) throw error;
  // 3. Journal (qui, quand, quoi)
  await journaliser({
    organizationId: document.organization_id,
    projectId: params.projectId,
    source: "document",
    action: `document:${document.kind}`,
    resume: params.resume,
    changements,
  });
}

/** Pièces CONFIRMÉES → annexe des rapports (les plus récentes d'abord). */
export function piecesDepuisDocuments(documents: ClientDocumentRow[]): PieceJustificative[] {
  return documents
    .filter((d) => d.status === "confirmed")
    .map((d) => ({
      type: d.kind as PieceJustificative["type"],
      fournisseur: d.supplier,
      date: d.document_date,
      fichier: d.file_name,
      empreinte: d.sha256,
      confirmeeLe: d.confirmed_at,
      valeurs: Array.isArray(d.applied) ? (d.applied as unknown as PieceJustificative["valeurs"]) : [],
    }));
}
