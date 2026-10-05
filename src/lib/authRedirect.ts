/**
 * Liens de retour des courriels d'authentification (confirmation
 * d'inscription, réinitialisation du mot de passe).
 *
 * Deux déploiements :
 * - production (BrowserRouter) : https://domaine/reset-password ;
 * - site de test GitHub Pages / aperçu (HashRouter, base /vraih2fleet/) :
 *   le lien pointe sur la RACINE du site (https://…/vraih2fleet/) — un
 *   « #/reset-password » serait écrasé par les jetons que Supabase ajoute
 *   dans le hash (flux implicit), et supabase-js vide ensuite le hash.
 *
 * Le type de retour (recovery, signup…) est donc lu dans l'URL AU
 * CHARGEMENT, avant que le client Supabase ne la nettoie, puis
 * l'application route vers la bonne page (AuthRedirectHandler).
 */

export interface EnvironnementUrl {
  origin: string;
  /** window.location.pathname (sert quand la base est relative : « ./ »). */
  pathname: string;
  /** import.meta.env.BASE_URL (« / », « /vraih2fleet/ » ou « ./ »). */
  base: string;
  hashRouter: boolean;
}

/** Répertoire de base absolu, toujours terminé par « / ». */
function baseAbsolue(env: EnvironnementUrl): string {
  if (env.base.startsWith("/")) return env.base.endsWith("/") ? env.base : `${env.base}/`;
  // Base relative (aperçu) : le répertoire de la page courante.
  const dossier = env.pathname.replace(/[^/]*$/, "");
  return dossier || "/";
}

/** URL à donner à Supabase comme `emailRedirectTo` / `redirectTo`. */
export function construireUrlRetour(env: EnvironnementUrl, route: string): string {
  const racine = `${env.origin}${baseAbsolue(env)}`;
  if (env.hashRouter) return racine;
  return `${racine}${route.replace(/^\//, "")}`;
}

export type TypeRetourAuth = "recovery" | "signup" | "magiclink" | "invite" | "email_change";

export interface RetourAuth {
  type: TypeRetourAuth | null;
  /** Lien expiré ou invalide (error_description renvoyé par Supabase). */
  erreur: string | null;
  /** error_code de Supabase (ex. « otp_expired »), s'il est fourni. */
  code?: string | null;
}

const TYPES: readonly string[] = ["recovery", "signup", "magiclink", "invite", "email_change"];

/** Lit le retour d'un lien de courriel dans le hash ou la query ; null sinon. */
export function lireRetourAuth(hash: string, search: string): RetourAuth | null {
  const params = new URLSearchParams(hash.replace(/^#\/?/, ""));
  new URLSearchParams(search).forEach((v, k) => params.set(k, v));
  const erreur = params.get("error_description") ?? params.get("error");
  if (erreur) return { type: null, erreur, code: params.get("error_code") };
  const avecSession = params.has("access_token") || params.has("code");
  const type = params.get("type");
  if (!avecSession && !type) return null;
  return { type: type && TYPES.includes(type) ? (type as TypeRetourAuth) : null, erreur: null };
}

/** Page d'arrivée d'un lien de confirmation (succès ou erreur expliquée). */
export const PAGE_CONFIRMATION = "/auth/confirme";

/** Page vers laquelle envoyer l'utilisateur après un retour de courriel. */
export function destinationRetour(retour: RetourAuth): string {
  if (retour.erreur) return PAGE_CONFIRMATION;
  if (retour.type === "recovery") return "/reset-password";
  if (retour.type === "signup" || retour.type === "invite" || retour.type === "email_change") return PAGE_CONFIRMATION;
  return "/dashboard";
}

// Capturé au chargement du module (importé en premier dans main.tsx),
// AVANT que supabase-js ne vide le hash.
let retourInitial: RetourAuth | null =
  typeof window === "undefined" ? null : lireRetourAuth(window.location.hash, window.location.search);

/** Retour capturé au chargement ; consommé une seule fois. */
export function consommerRetourInitial(): RetourAuth | null {
  const r = retourInitial;
  retourInitial = null;
  return r;
}

/** URL de retour pour l'environnement courant du navigateur. */
export function urlRetourAuth(route: string): string {
  return construireUrlRetour(
    {
      origin: window.location.origin,
      pathname: window.location.pathname,
      base: import.meta.env.BASE_URL,
      hashRouter: import.meta.env.VITE_PREVIEW_HASH_ROUTER === "true",
    },
    route,
  );
}
