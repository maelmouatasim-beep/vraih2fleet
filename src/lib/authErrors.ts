/**
 * Erreurs d'authentification Supabase → clé de traduction (fr/en).
 * Le message brut du serveur (en anglais, parfois technique : « email rate
 * limit exceeded ») n'est JAMAIS affiché tel quel. PUR, testé.
 */
export interface ErreurAuth {
  message?: string;
  code?: string;
  status?: number;
}

const PAR_CODE: Record<string, string> = {
  over_email_send_rate_limit: "emailRateLimit",
  over_request_rate_limit: "requestRateLimit",
  over_sms_send_rate_limit: "requestRateLimit",
  email_address_invalid: "emailInvalid",
  email_address_not_authorized: "emailNotAuthorized",
  user_already_exists: "emailInUse",
  email_exists: "emailInUse",
  weak_password: "weakPassword",
  invalid_credentials: "invalidCredentials",
  email_not_confirmed: "emailNotConfirmed",
  signup_disabled: "signupDisabled",
  same_password: "samePassword",
  user_not_found: "invalidCredentials",
};

/** Anciennes versions du serveur sans `code` : repérage sur le message. */
const PAR_MESSAGE: [RegExp, string][] = [
  [/rate limit/i, "emailRateLimit"],
  [/already registered|already exists/i, "emailInUse"],
  [/invalid login credentials/i, "invalidCredentials"],
  [/email not confirmed/i, "emailNotConfirmed"],
  [/is invalid/i, "emailInvalid"],
  [/password should|weak password/i, "weakPassword"],
  [/signups? not allowed|signup is disabled/i, "signupDisabled"],
  [/failed to fetch|network/i, "network"],
];

export function cleErreurAuth(e: ErreurAuth | null | undefined): string {
  if (!e) return "auth.errors.codes.generic";
  if (e.code && PAR_CODE[e.code]) return `auth.errors.codes.${PAR_CODE[e.code]}`;
  const m = PAR_MESSAGE.find(([re]) => re.test(e.message ?? ""));
  if (m) return `auth.errors.codes.${m[1]}`;
  if (e.status === 429) return "auth.errors.codes.requestRateLimit";
  return "auth.errors.codes.generic";
}
