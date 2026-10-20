import { SPACE_PATHS } from "@leaseplace/domain";

const ALLOWED = ["/espace", ...Object.values(SPACE_PATHS)];

/**
 * Redirection après connexion : uniquement vers un espace connu (aucune
 * redirection ouverte vers un domaine tiers).
 */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return "/espace";
  const ok = ALLOWED.some((p) => value === p || value.startsWith(`${p}/`));
  return ok ? value : "/espace";
}
