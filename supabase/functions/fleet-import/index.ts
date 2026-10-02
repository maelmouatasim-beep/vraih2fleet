// fleet-import — import intelligent de flotte (Phase 5.3), API Claude.
// JWT obligatoire ; fonction « import intelligent » activée pour
// l'organisation ; quotas et débit ; usage journalisé (jetons seulement).
// Seuls les entêtes et quelques valeurs d'exemple sont reçus (jamais les
// colonnes personnelles, filtrées dans le navigateur) ; rien n'est stocké.
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
import { proposerCorrespondance, zCorpsImport, type CorpsImport } from "./core.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  try {
    const { user, supabase } = await getUserOrThrow(req);
    const corps = (await parseJsonBody(req, zCorpsImport, 256 * 1024)) as CorpsImport;
    if (iaDesactiveeGlobalement()) return jsonResponse(req, { error: "service_non_configure" }, 503);

    const reglages = await lireReglages(supabase, corps.organizationId, "import");
    if (!reglages?.actif) throw new HttpError(403, "fonction_desactivee");
    const anthropic = clientAnthropic();
    if (!anthropic) return jsonResponse(req, { error: "service_non_configure" }, 503);

    const service = serviceRoleClient();
    if (!(await debitUtilisateurOk(service, "import", user.id, 20))) throw new HttpError(429, "trop_de_requetes");
    verifierQuotas(reglages, await resumeUsage(service, corps.organizationId));

    const sortie = await proposerCorrespondance(corps, {
      modele: modeleIa(),
      appelerClaude: async (params) => (await anthropic.beta.messages.create(params as never)) as never,
      journaliserUsage: (modele, usage) =>
        journaliserUsage(service, { organizationId: corps.organizationId, userId: user.id, fonction: "import", modele, usage }),
    });
    return jsonResponse(req, sortie);
  } catch (error: unknown) {
    if (error instanceof HttpError) return jsonResponse(req, { error: error.message }, error.status);
    if (error instanceof ValidationError) return jsonResponse(req, { error: error.message }, 400);
    console.error("fleet-import:", error instanceof Error ? error.name : "erreur");
    return jsonResponse(req, { error: "erreur_service" }, 502);
  }
});
