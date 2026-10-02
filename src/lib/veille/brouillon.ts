/**
 * Phase 5.5 — Brouillon de résumé d'un changement détecté (fr/en), à
 * partir des faits ajoutés / retirés : point de départ que
 * l'administrateur corrige avant de valider. Module PUR.
 */
export interface FaitVeille {
  type: "montant" | "date" | "statut";
  valeur: string;
}

const STATUTS = {
  fr: { ferme: "fermé", suspendu: "suspendu", epuise: "fonds épuisés", ouvert: "ouvert" },
  en: { ferme: "closed", suspendu: "suspended", epuise: "funds exhausted", ouvert: "open" },
} as const;

function formater(f: FaitVeille, langue: "fr" | "en"): string {
  if (f.type === "montant") {
    const n = Number(f.valeur);
    return langue === "fr" ? `${n.toLocaleString("fr-CA")} $` : `$${n.toLocaleString("en-CA")}`;
  }
  if (f.type === "statut") return (STATUTS[langue] as Record<string, string>)[f.valeur] ?? f.valeur;
  return f.valeur;
}

export function brouillonResume(
  nomProgramme: string,
  type: FaitVeille["type"],
  retires: FaitVeille[],
  ajoutes: FaitVeille[],
  langue: "fr" | "en",
): string {
  const avant = retires.map((f) => formater(f, langue)).join(", ");
  const apres = ajoutes.map((f) => formater(f, langue)).join(", ");
  const quoi = {
    fr: { montant: "montant", date: "date", statut: "statut" },
    en: { montant: "amount", date: "date", statut: "status" },
  }[langue][type];
  if (langue === "fr") {
    return `${nomProgramme} : changement de ${quoi} sur la page officielle${avant ? ` — avant : ${avant}` : ""}${apres ? ` — maintenant : ${apres}` : ""}.`;
  }
  return `${nomProgramme}: ${quoi} change on the official page${avant ? ` — before: ${avant}` : ""}${apres ? ` — now: ${apres}` : ""}.`;
}
