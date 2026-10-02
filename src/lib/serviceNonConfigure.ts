/**
 * Services externes pas encore branchés sur un environnement (site de test
 * sans SendGrid, sans clé IA, sans Mapbox) : les edge functions répondent
 * 503 { error: "service_non_configure" } ; l'interface affiche alors un
 * message clair au lieu d'une erreur générique.
 */
export const CODE_SERVICE_NON_CONFIGURE = "service_non_configure";

interface ErreurAvecContexte {
  context?: unknown;
}

/** Vrai si l'erreur de functions.invoke (ou une Response) signale un service non configuré. */
export async function estServiceNonConfigure(erreur: unknown): Promise<boolean> {
  const reponse =
    erreur instanceof Response ? erreur : (erreur as ErreurAvecContexte | null)?.context;
  if (!(reponse instanceof Response) || reponse.status !== 503) return false;
  try {
    const corps = await reponse.clone().json();
    return corps?.error === CODE_SERVICE_NON_CONFIGURE;
  } catch {
    return false;
  }
}
