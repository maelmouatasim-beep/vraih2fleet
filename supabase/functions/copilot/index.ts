// copilot — copilote de projet (Phase 5.2), fournisseur : API Claude
// (Anthropic). Remplace l'ancien assistant-chat (passerelle Lovable).
// - JWT obligatoire (getUserOrThrow) ; le projet est relu avec le client
//   RLS de l'utilisateur (il doit pouvoir le voir) ;
// - fonction activable par organisation, quotas jour/mois, débit par
//   utilisateur, usage journalisé (jetons seulement) ;
// - sans ANTHROPIC_API_KEY : 503 `service_non_configure` (message propre) ;
// - aucun contenu n'est journalisé dans les logs ; l'historique ne garde
//   que les réponses dont les nombres ont été vérifiés.
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
import { traiterTour, zCorpsCopilote, type CorpsCopilote, type ReponseClaude } from "./core.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  try {
    const { user, supabase } = await getUserOrThrow(req);
    // parseJsonBody renvoie la sortie zod (valeurs par défaut appliquées).
    const corps = (await parseJsonBody(req, zCorpsCopilote, 1024 * 1024)) as CorpsCopilote;

    if (iaDesactiveeGlobalement()) return jsonResponse(req, { error: "service_non_configure" }, 503);

    // Le projet doit être visible par l'appelant ET appartenir à l'organisation.
    const { data: projet } = await supabase
      .from("projects")
      .select("id, organization_id")
      .eq("id", corps.projectId)
      .maybeSingle();
    if (!projet || projet.organization_id !== corps.organizationId) throw new HttpError(404, "projet_introuvable");

    const reglages = await lireReglages(supabase, corps.organizationId, "copilote");
    if (!reglages?.actif) throw new HttpError(403, "fonction_desactivee");

    const anthropic = clientAnthropic();
    if (!anthropic) return jsonResponse(req, { error: "service_non_configure" }, 503);

    const service = serviceRoleClient();
    if (!(await debitUtilisateurOk(service, "copilote", user.id))) throw new HttpError(429, "trop_de_requetes");

    const sortie = await traiterTour(corps, {
      modele: modeleIa(),
      appelerClaude: async (params) => {
        // Paramètres bêta (fallbacks, block_binding) : transmis tels quels.
        const r = await anthropic.beta.messages.create(params as never);
        return r as unknown as ReponseClaude;
      },
      controler: async () => verifierQuotas(reglages, await resumeUsage(service, corps.organizationId)),
      journaliserUsage: (modele, usage) =>
        journaliserUsage(service, {
          organizationId: corps.organizationId,
          userId: user.id,
          fonction: "copilote",
          modele,
          usage,
        }),
      enregistrer: async (e) => {
        // Client de l'UTILISATEUR (RLS) : historique visible par l'équipe du projet.
        const { error: eq } = await supabase
          .from("copilot_messages")
          .insert({ project_id: corps.projectId, role: "user", content: e.question });
        if (eq) throw new HttpError(403, "historique_refuse");
        const { data, error } = await supabase
          .from("copilot_messages")
          .insert({
            project_id: corps.projectId,
            role: "assistant",
            content: e.reponse,
            sources: e.sources,
            verified_numbers: e.nombresVerifies,
            proposal: e.proposition ?? null,
          })
          .select("id")
          .single();
        if (error) throw new HttpError(403, "historique_refuse");
        return data.id as string;
      },
    });
    return jsonResponse(req, sortie);
  } catch (error: unknown) {
    if (error instanceof HttpError) return jsonResponse(req, { error: error.message }, error.status);
    if (error instanceof ValidationError) return jsonResponse(req, { error: error.message }, 400);
    // Jamais de contenu (question, données) dans les journaux.
    console.error("copilot:", error instanceof Error ? error.name : "erreur");
    return jsonResponse(req, { error: "erreur_service" }, 502);
  }
});
