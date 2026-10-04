/**
 * Nom de l'organisation sur les rapports (audit acheteur, point 11) : le
 * nom créé par défaut à l'inscription (« Mon organisation ») ne doit
 * jamais figurer en en-tête d'un PDF, d'une note au conseil ou d'un
 * classeur. PUR, testé.
 */
const NOMS_PAR_DEFAUT = new Set(["mon organisation", "my organization", "my organisation"]);

/** Nom absent ou créé par défaut (à faire renseigner). */
export function estNomOrganisationParDefaut(nom: string | null | undefined): boolean {
  const n = nom?.trim().toLocaleLowerCase("fr");
  return !n || NOMS_PAR_DEFAUT.has(n);
}

/** Nom affiché sur les rapports d'un projet : celui de l'organisation ;
 *  pour le projet de démonstration d'une organisation sans nom, la
 *  municipalité FICTIVE de la démo (jamais « Mon organisation »). */
export function nomOrganisationRapport(
  nom: string | null | undefined,
  projetDemo: boolean,
  langue: "fr" | "en",
): string {
  if (!estNomOrganisationParDefaut(nom)) return nom!.trim();
  if (projetDemo) return langue === "en" ? "City of Rivière-Claire (fictitious)" : "Ville de Rivière-Claire (fictive)";
  return langue === "en" ? "Organization (name to be entered)" : "Organisation (nom à renseigner)";
}
