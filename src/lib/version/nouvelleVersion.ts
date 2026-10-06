/**
 * Détection d'une nouvelle version déployée — logique PURE, testée.
 *
 * Chaque build écrit `version.json` ({ version }) et la même valeur dans
 * `<meta name="h2fleet-version">` de index.html : la balise dit quelle
 * version TOURNE dans l'onglet, le fichier quelle version est EN LIGNE.
 * Différentes → bandeau « Nouvelle version disponible — Recharger ».
 * Jamais de rechargement automatique (une saisie en cours serait perdue).
 */

/** Vérification périodique (en plus du retour sur l'onglet). */
export const INTERVALLE_VERIFICATION_MS = 5 * 60 * 1000;

export const NOM_META_VERSION = "h2fleet-version";

/** Identifiant de build : commit (CI) + horodatage, toujours différent d'un build à l'autre. */
export function identifiantBuild(commit: string | undefined, maintenantMs: number): string {
  const c = (commit ?? "").trim().slice(0, 7) || "local";
  return `${c}-${maintenantMs.toString(36)}`;
}

/** Version annoncée par version.json ; null si le contenu est illisible. */
export function versionDistante(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const v = (json as { version?: unknown }).version;
  return typeof v === "string" && v.length > 0 && v.length <= 100 ? v : null;
}

/** Vrai seulement si les deux versions sont connues et différentes. */
export function nouvelleVersionDisponible(courante: string | null, distante: string | null): boolean {
  return !!courante && !!distante && courante !== distante;
}

/** Adresse de version.json à côté de index.html (base Vite), sans cache. */
export function urlVersion(base: string, maintenantMs: number): string {
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}version.json?t=${maintenantMs}`;
}
