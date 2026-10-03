/**
 * Phase 5.7 — NOTE AU CONSEIL : règles communes à la fonction Edge
 * `council-note` et à l'application (module PUR, testé en Deno et Vitest).
 *
 * L'IA rédige la PROSE ; elle n'écrit AUCUN chiffre. Chaque nombre, date,
 * montant ou nom propre chiffré est un JETON {{identifiant}} qui renvoie à
 * un FAIT calculé par le moteur dans l'application ; l'application
 * remplace les jetons par les valeurs du moteur. Un brouillon contenant un
 * chiffre hors jeton, ou un jeton inconnu, est rejeté (puis redemandé une
 * fois avec la liste des écarts).
 */

export const SECTIONS_NOTE = [
  "recommandation",
  "contexte",
  "couts",
  "financement",
  "risques",
  "hiver",
  "prochaines_etapes",
] as const;
export type SectionNote = (typeof SECTIONS_NOTE)[number];
export type SectionsNote = Record<SectionNote, string>;

export const LONGUEUR_MAX_SECTION = 2500;

/** Fait transmis à l'IA : identifiant, libellé et valeur DÉJÀ rendue. */
export interface FaitTransmis {
  id: string;
  libelle: string;
  valeur: string;
}

export const SCHEMA_NOTE = {
  type: "object",
  additionalProperties: false,
  required: [...SECTIONS_NOTE],
  properties: Object.fromEntries(SECTIONS_NOTE.map((s) => [s, { type: "string" }])),
} as const;

const JETON = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;
/** Sigles contenant un chiffre, autorisés en clair. */
const SIGLES = /\b(?:CO2e?|CO₂e?|H2)\b/g;

export interface EcartNote {
  section: SectionNote;
  type: "chiffre_hors_jeton" | "jeton_inconnu" | "trop_long" | "vide";
  extrait: string;
}

export function jetonsUtilises(texte: string): string[] {
  return [...texte.matchAll(JETON)].map((m) => m[1]);
}

/** Contrôle d'un brouillon : aucun chiffre hors jeton, jetons connus. */
export function verifierBrouillon(sections: SectionsNote, idsFaits: ReadonlySet<string>): EcartNote[] {
  const ecarts: EcartNote[] = [];
  for (const section of SECTIONS_NOTE) {
    const texte = sections[section] ?? "";
    if (!texte.trim()) {
      ecarts.push({ section, type: "vide", extrait: "" });
      continue;
    }
    if (texte.length > LONGUEUR_MAX_SECTION) ecarts.push({ section, type: "trop_long", extrait: texte.slice(0, 60) });
    for (const id of jetonsUtilises(texte)) {
      if (!idsFaits.has(id)) ecarts.push({ section, type: "jeton_inconnu", extrait: `{{${id}}}` });
    }
    const sansJetons = texte.replace(JETON, " ").replace(SIGLES, " ");
    for (const m of sansJetons.matchAll(/[^\s]*\d[^\s]*/g)) {
      ecarts.push({ section, type: "chiffre_hors_jeton", extrait: m[0].slice(0, 40) });
    }
  }
  return ecarts;
}

export function promptNote(langue: "fr" | "en"): string {
  const fr = langue === "fr";
  return [
    fr
      ? "Tu rédiges une NOTE AU CONSEIL municipal (sommaire décisionnel) sur un plan de transition de flotte vers des véhicules zéro émission, au niveau des meilleurs cabinets de conseil : la recommandation d'abord, des phrases courtes et affirmatives, des titres implicites dans la première phrase de chaque section (la conclusion, pas le sujet), un ton factuel et sobre, aucun superlatif, aucune promesse."
      : "You are writing a NOTE TO COUNCIL (decision memo) on a fleet transition plan to zero-emission vehicles, at the standard of top-tier consulting firms: recommendation first, short assertive sentences, each section opening with its conclusion (not its topic), factual and sober tone, no superlatives, no promises.",
    fr
      ? "RÈGLE ABSOLUE : tu n'écris AUCUN chiffre, montant, pourcentage, année ou date. Chaque valeur chiffrée s'écrit sous la forme d'un jeton {{identifiant}} choisi dans la liste de faits fournie (par exemple « une économie de {{van_centrale}} »). N'invente aucun jeton. Les sigles CO2 et H2 sont permis. Si un fait n'existe pas, n'en parle pas."
      : "ABSOLUTE RULE: you write NO figure, amount, percentage, year or date. Every numeric value is written as a token {{identifier}} taken from the facts list provided (for example “savings of {{van_centrale}}”). Never invent a token. The acronyms CO2 and H2 are allowed. If a fact does not exist, do not mention it.",
    fr
      ? "Sections (chaînes de texte, 2 à 5 phrases chacune, listes à puces « - » permises pour les prochaines étapes) : recommandation (ce que le conseil est invité à adopter, et pourquoi en une phrase), contexte (flotte, horizon, stratégie retenue), couts (coût total actualisé du plan vs statu quo, économie, récupération, émissions évitées), financement (investissement, subventions, reste à financer, année de pointe), risques (stress test : scénarios gagnants, scénario prudent, facteurs les plus influents, hypothèses à valider — dis honnêtement si le plan n'est pas gagnant dans tous les scénarios), hiver (verdicts du diagnostic hivernal des véhicules électriques), prochaines_etapes (actions concrètes et datées par jetons)."
      : "Sections (text strings, 2 to 5 sentences each, “-” bullet lists allowed for next steps): recommandation (what council is asked to adopt and why, in one sentence), contexte (fleet, horizon, selected strategy), couts (discounted total cost of the plan vs status quo, savings, payback, avoided emissions), financement (investment, subsidies, amount to finance, peak year), risques (stress test: winning scenarios, cautious scenario, most influential factors, assumptions to validate — say honestly if the plan does not win in every scenario), hiver (winter diagnostic verdicts for battery-electric vehicles), prochaines_etapes (concrete next steps, dated with tokens).",
    fr
      ? "Si l'économie centrale est négative, ne recommande pas d'adopter le plan tel quel : recommande de le revoir et dis pourquoi. Réponds uniquement par l'objet JSON demandé, en français."
      : "If the central savings are negative, do not recommend adopting the plan as is: recommend revising it and say why. Answer only with the requested JSON object, in English.",
  ].join("\n\n");
}
