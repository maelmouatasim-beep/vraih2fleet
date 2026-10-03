// council-note — note au conseil (Phase 5.7), API Claude. JWT obligatoire ;
// projet relu avec le client RLS (l'utilisateur doit le voir) ; fonction
// « note au conseil » activée pour l'organisation du projet ; quotas et
// débit ; usage journalisé (jetons seulement). Minimisation : seuls des
// faits agrégés du plan sont transmis (aucun nom de personne, aucune
// donnée de véhicule individuelle). Aucun chiffre n'est écrit par l'IA.
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
import { redigerNote, zCorpsNote, type CorpsNote } from "./core.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  try {
    const { user, supabase } = await getUserOrThrow(req);
    const corps = (await parseJsonBody(req, zCorpsNote, 128 * 1024)) as CorpsNote;
    if (iaDesactiveeGlobalement()) return jsonResponse(req, { error: "service_non_configure" }, 503);

    const { data: projet } = await supabase
      .from("projects")
      .select("id, organization_id")
      .eq("id", corps.projectId)
      .maybeSingle();
    if (!projet?.organization_id) throw new HttpError(404, "projet_introuvable");

    const reglages = await lireReglages(supabase, projet.organization_id, "note_conseil");
    if (!reglages?.actif) throw new HttpError(403, "fonction_desactivee");
    const anthropic = clientAnthropic();
    if (!anthropic) return jsonResponse(req, { error: "service_non_configure" }, 503);

    const service = serviceRoleClient();
    if (!(await debitUtilisateurOk(service, "note_conseil", user.id, 10))) throw new HttpError(429, "trop_de_requetes");
    verifierQuotas(reglages, await resumeUsage(service, projet.organization_id));

    const sortie = await redigerNote(corps, {
      modele: modeleIa(),
      appelerClaude: async (params) => (await anthropic.beta.messages.create(params as never)) as never,
      journaliserUsage: (modele, usage) =>
        journaliserUsage(service, { organizationId: projet.organization_id, userId: user.id, fonction: "note_conseil", modele, usage }),
    });
    return jsonResponse(req, sortie);
  } catch (error: unknown) {
    if (error instanceof HttpError) return jsonResponse(req, { error: error.message }, error.status);
    if (error instanceof ValidationError) return jsonResponse(req, { error: error.message }, 400);
    console.error("council-note:", error instanceof Error ? error.name : "erreur");
    return jsonResponse(req, { error: "erreur_service" }, 502);
  }
});
