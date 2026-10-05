/**
 * Courriel de test (Paramètres, administrateurs H2Fleet) : traduit la
 * réponse de send-email (gabarit « test_email ») en une issue affichable.
 * PUR et testé ; l'appel réseau est dans CourrielTest.tsx.
 */
export type IssueCourrielTest =
  | "envoye"
  | "non_configure"
  | "smtp_auth"
  | "smtp_connexion"
  | "smtp_refus"
  | "interdit"
  | "trop_de_demandes"
  | "echec";

export function issueCourrielTest(statut: number, corps: unknown): IssueCourrielTest {
  if (statut >= 200 && statut < 300) return "envoye";
  const code = (corps as { error?: unknown } | null)?.error;
  if (statut === 503 && code === "service_non_configure") return "non_configure";
  if (statut === 502 && (code === "smtp_auth" || code === "smtp_connexion" || code === "smtp_refus")) return code;
  if (statut === 403) return "interdit";
  if (statut === 429) return "trop_de_demandes";
  return "echec";
}

export const adresseValide = (s: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim()) && s.trim().length <= 254;
