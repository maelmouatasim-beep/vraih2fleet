/**
 * Phase 5.7 — Règles de mise en page des livrables (pures, testées) :
 * titre d'action = première phrase d'une section (sa conclusion).
 */
/** Découpe une section : la première phrase devient le titre d'action
 *  (la conclusion), le reste le corps. */
export function titreEtCorps(texte: string): { titre: string; corps: string } {
  const t = texte.trim();
  const premiereLigne = t.split("\n")[0];
  if (premiereLigne.startsWith("- ")) return { titre: "", corps: t };
  const candidats = [premiereLigne.search(/\.\s/), premiereLigne.search(/\s?:\s/)].filter((i) => i > 20 && i < 220);
  if (candidats.length === 0) {
    if (premiereLigne.length <= 220 && /\.$/.test(premiereLigne)) {
      return { titre: premiereLigne.replace(/\.$/, ""), corps: t.slice(premiereLigne.length).trim() };
    }
    return { titre: "", corps: t };
  }
  const i = Math.min(...candidats);
  const titre = premiereLigne.slice(0, i).trim();
  const reste = t.slice(i).replace(/^\s?[.:]\s*/, "");
  return { titre, corps: reste ? reste.charAt(0).toLocaleUpperCase() + reste.slice(1) : "" };
}

