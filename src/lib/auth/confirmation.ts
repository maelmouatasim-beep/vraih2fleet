/**
 * Parcours de confirmation de courriel — logique PURE, testée.
 * (Page d'arrivée : src/pages/ConfirmationCourriel.tsx ; attente :
 * src/components/auth/AttenteConfirmation.tsx.)
 */

/** Délai minimal entre deux renvois du courriel de confirmation. */
export const DELAI_RENVOI_S = 60;
/** Durée de l'écran « Adresse confirmée » avant la redirection. */
export const DELAI_REDIRECTION_MS = 2500;

export type TypeErreurLien = "expire" | "invalide";

/**
 * Erreur d'un lien de courriel → message à afficher. Supabase renvoie
 * « otp_expired » pour un lien expiré OU déjà utilisé : un seul message
 * couvre les deux. Le texte brut du serveur n'est jamais affiché.
 */
export function typeErreurLien(code: string | null | undefined, description?: string | null): TypeErreurLien {
  if (code === "otp_expired" || code === "flow_state_expired") return "expire";
  if (!code && /expired/i.test(description ?? "")) return "expire";
  return "invalide";
}

/** Code à 6 chiffres du courriel (espaces et tirets tolérés) ; null si invalide. */
export function normaliserCodeOtp(saisie: string): string | null {
  const chiffres = saisie.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(chiffres) ? chiffres : null;
}

/** Secondes avant de pouvoir renvoyer le courriel (0 = possible). */
export function secondesAvantRenvoi(dernierEnvoiMs: number | null, maintenantMs: number, delaiS = DELAI_RENVOI_S): number {
  if (dernierEnvoiMs === null) return 0;
  return Math.max(0, Math.ceil((dernierEnvoiMs + delaiS * 1000 - maintenantMs) / 1000));
}

/**
 * Issue d'un renvoi de courriel → message. Hors limite de débit, la
 * réponse est TOUJOURS neutre : on ne révèle jamais si l'adresse a déjà un
 * compte (confirmé ou non) — pas d'énumération.
 */
export function issueRenvoi(erreur: { code?: string; status?: number; message?: string } | null): "envoye_neutre" | "trop_de_demandes" {
  if (!erreur) return "envoye_neutre";
  const limite =
    erreur.status === 429 ||
    erreur.code === "over_email_send_rate_limit" ||
    erreur.code === "over_request_rate_limit" ||
    /rate limit|security purposes/i.test(erreur.message ?? "");
  return limite ? "trop_de_demandes" : "envoye_neutre";
}

/** Lien « Me connecter » avec l'adresse préremplie. */
export function lienConnexion(email: string): string {
  return `/login?email=${encodeURIComponent(email.trim())}`;
}

/**
 * Lien « Vous avez reçu un code de confirmation ? » (adresse + code), avec
 * l'adresse déjà saisie si elle est valide.
 */
export function lienCodeConfirmation(email = ""): string {
  const e = email.trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 254
    ? `/auth/verifier?saisie=1&email=${encodeURIComponent(e)}`
    : "/auth/verifier?saisie=1";
}

/** Vrai si l'erreur de connexion signifie « compte pas encore confirmé » (mot de passe correct). */
export function estNonConfirme(e: { code?: string; message?: string } | null | undefined): boolean {
  return !!e && (e.code === "email_not_confirmed" || /email not confirmed/i.test(e.message ?? ""));
}

/** Adresse préremplie lue dans la query (?email=) ; vide si absente ou invalide. */
export function emailPrerempli(search: string): string {
  const v = new URLSearchParams(search).get("email") ?? "";
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && v.length <= 254 ? v : "";
}
