/**
 * Règles d'authentification PURES (testées) appliquées par les hooks de
 * Better-Auth.
 *
 * Bailleurs et équipe plateforme : double authentification obligatoire.
 * Une session ne peut donc naître, pour eux, que d'un mot de passe (le
 * plugin exige ensuite le code TOTP s'il est activé ; sinon l'enrôlement est
 * imposé avant tout accès) ou d'une vérification TOTP / code de secours.
 * Lien magique et code par courriel leur sont fermés.
 */

export const STRONG_SESSION_PATHS = new Set([
  "/sign-in/email",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
]);

export type SignInMethod =
  | "password"
  | "totp"
  | "backup_code"
  | "magic_link"
  | "email_otp"
  | "other";

const METHOD_BY_PATH: Readonly<Record<string, SignInMethod>> = {
  "/sign-in/email": "password",
  "/two-factor/verify-totp": "totp",
  "/two-factor/verify-backup-code": "backup_code",
  "/magic-link/verify": "magic_link",
  "/sign-in/email-otp": "email_otp",
};

export function signInMethodOf(path: string | undefined): SignInMethod {
  return (path !== undefined && METHOD_BY_PATH[path]) || "other";
}

/**
 * `path` absent : création interne côté serveur (jeu de démo, tests),
 * autorisée.
 */
export function isSessionCreationAllowed({
  strictTwoFactor,
  path,
}: {
  strictTwoFactor: boolean;
  path: string | undefined;
}): boolean {
  if (!strictTwoFactor || path === undefined) return true;
  return STRONG_SESSION_PATHS.has(path);
}

/** Les comptes à 2FA obligatoire ne peuvent pas la désactiver. */
export function isTwoFactorDisableAllowed(strictTwoFactor: boolean): boolean {
  return !strictTwoFactor;
}

/** N'envoie un lien ou un code par courriel qu'aux comptes sans 2FA obligatoire. */
export function isPasswordlessAllowed(strictTwoFactor: boolean): boolean {
  return !strictTwoFactor;
}
