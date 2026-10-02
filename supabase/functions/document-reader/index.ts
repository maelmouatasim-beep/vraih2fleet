// document-reader — lecture de factures et de devis (Phase 5.4), API
// Claude. JWT obligatoire ; la pièce est relue avec le client RLS de
// l'utilisateur (même organisation) ; fonction « lecture de factures et
// devis » activée pour l'organisation ; quotas et débit ; usage
// journalisé (jetons seulement). Minimisation : si le navigateur a lu une
// couche texte, seul ce texte est transmis ; sinon le fichier. Rien
// n'est stocké par la fonction.
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getUserOrThrow, HttpError, serviceRoleClient } from "../_shared/auth.ts";
import { parseJsonBody, ValidationError } from "../_shared/validation.ts";
import {
  clientAnthropic,
  debitUtilisateurOk,
  iaDesactiveeGlobalement,
  journaliserUsage,
  lireReglages,
  modeleIa,
  resumeUsage,
  verifierQuotas,
} from "../_shared/ai.ts";
import { TYPES_DOCUMENT, type TypeDocument } from "../_shared/documentSchema.ts";
import { extraireDocument, TEXTE_MINIMUM, zCorpsDocument, type CorpsDocument } from "./core.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  try {
    const { user, supabase } = await getUserOrThrow(req);
    const corps = (await parseJsonBody(req, zCorpsDocument, 512 * 1024)) as CorpsDocument;
    if (iaDesactiveeGlobalement()) return jsonResponse(req, { error: "service_non_configure" }, 503);

    const reglages = await lireReglages(supabase, corps.organizationId, "document");
    if (!reglages?.actif) throw new HttpError(403, "fonction_desactivee");

    // Pièce relue avec le client RLS : même organisation, encore à confirmer.
    const { data: piece } = await supabase
      .from("client_documents")
      .select("id, organization_id, kind, storage_path, mime_type, status")
      .eq("id", corps.documentId)
      .maybeSingle();
    if (!piece || piece.organization_id !== corps.organizationId) throw new HttpError(404, "document_introuvable");
    if (piece.status !== "pending") throw new HttpError(409, "document_deja_traite");
    if (!(TYPES_DOCUMENT as readonly string[]).includes(piece.kind)) throw new HttpError(400, "type_inconnu");
    const anthropic = clientAnthropic();
    if (!anthropic) return jsonResponse(req, { error: "service_non_configure" }, 503);

    const service = serviceRoleClient();
    if (!(await debitUtilisateurOk(service, "document", user.id, 20))) throw new HttpError(429, "trop_de_requetes");
    verifierQuotas(reglages, await resumeUsage(service, corps.organizationId));

    let fichier: { base64: string; mime: string } | null = null;
    if (!corps.texte || corps.texte.trim().length < TEXTE_MINIMUM) {
      const { data: blob, error } = await supabase.storage.from("client-documents").download(piece.storage_path);
      if (error || !blob) throw new HttpError(404, "document_introuvable");
      fichier = { base64: encodeBase64(new Uint8Array(await blob.arrayBuffer())), mime: piece.mime_type };
    }

    const sortie = await extraireDocument(
      corps,
      { type: piece.kind as TypeDocument, fichier },
      {
        modele: modeleIa(),
        appelerClaude: async (params) => (await anthropic.beta.messages.create(params as never)) as never,
        journaliserUsage: (modele, usage) =>
          journaliserUsage(service, { organizationId: corps.organizationId, userId: user.id, fonction: "document", modele, usage }),
      },
    );
    return jsonResponse(req, sortie);
  } catch (error: unknown) {
    if (error instanceof HttpError) return jsonResponse(req, { error: error.message }, error.status);
    if (error instanceof ValidationError) return jsonResponse(req, { error: error.message }, 400);
    console.error("document-reader:", error instanceof Error ? error.name : "erreur");
    return jsonResponse(req, { error: "erreur_service" }, 502);
  }
});
