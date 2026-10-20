/** Lecture directe (sans valider tout l'environnement) : sert au bandeau. */
export function isDemoMode(): boolean {
  return process.env.LP_DEMO_MODE === "true";
}
