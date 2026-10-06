/**
 * Phase 5, point 5 — VEILLE DES SUBVENTIONS : détection DÉTERMINISTE des
 * changements d'une page (ou d'un PDF) officielle d'un programme entre
 * deux lectures hebdomadaires. Aucune IA. Ce module ne décide RIEN : il
 * produit des « détections » (faits ajoutés / retirés + extraits avant →
 * après) qui vont dans une file de validation ; un administrateur H2Fleet
 * les valide ou les rejette, jamais d'application automatique.
 *
 * Module PUR, sans import : utilisé par l'application (tests) et par le
 * script du workflow (node --experimental-strip-types).
 */

export type TypeFait = "montant" | "date" | "statut";

export interface Fait {
  type: TypeFait;
  /** Valeur normalisée (5000, 2027-03-31, ferme…) — clé de comparaison. */
  valeur: string;
  /** Contexte lisible (la ligne du document, tronquée). */
  extrait: string;
}

export interface Detection {
  programmeId: string;
  url: string;
  type: TypeFait;
  ajoutes: Fait[];
  retires: Fait[];
  extraitAvant: string;
  extraitApres: string;
  /** Clé stable (programme + type + faits) : jamais deux fois la même détection. */
  cleDedoublonnage: string;
}

const MOIS: Record<string, string> = {
  janvier: "01", fevrier: "02", mars: "03", avril: "04", mai: "05", juin: "06", juillet: "07",
  aout: "08", septembre: "09", octobre: "10", novembre: "11", decembre: "12",
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07",
  august: "08", september: "09", october: "10", november: "11", december: "12",
};

/** Mots de statut surveillés → statut normalisé. */
const STATUTS: [RegExp, string][] = [
  [/\b(ferm[ée]e?s?|closed|termin[ée]e?s?)\b/, "ferme"],
  [/\b(suspendue?s?|suspended|en pause|paused)\b/, "suspendu"],
  [/\b([ée]puis[ée]e?s?|fonds [ée]puis[ée]s|fully subscribed|no longer accepting)\b/, "epuise"],
  [/\b(ouverte?s?|open for applications|accepting applications)\b/, "ouvert"],
];

/**
 * Un mot de statut ne compte que s'il porte sur le PROGRAMME lui-même :
 * - en tête de ligne (bandeau ou titre : « Fermé aux demandes »,
 *   « Closed: Incentives for… ») ;
 * - ou à au plus 6 mots d'un SUJET (programme, volet, appel, demandes,
 *   inscriptions, fonds, enveloppe…) ;
 * - ou juste après « est / sont (maintenant) » dans une phrase qui nomme un
 *   sujet (FTCZE : « La période de soumission des demandes … est
 *   maintenant terminée »).
 * Jamais dans une ligne conditionnelle ou future (« si », « jusqu'à ce
 * que les fonds soient épuisés », « la demande sera fermée »), ni quand
 * il parle d'un tiers (« le recouvrement de ses dettes a été légalement
 * suspendu », Revenu Québec) ou d'un lien de navigation (« Gouvernement
 * ouvert », « données ouvertes »). Faux positif d'origine : Écocamionnage
 * volet 1, lecture du 2026-10-05.
 */
const SUJET_STATUT =
  /^(programmes?|volets?|appels?|demandes?|inscriptions?|fonds|enveloppes?|subventions?|programs?|applications?|intakes?|streams?|funding|funds|calls?)$/;
const EXCLU_STATUT = new RegExp(
  [
    "\\bsi\\b", "\\bs'il", "jusqu'a ce que", "jusqu'a epuisement", "\\blorsque\\b", "\\bdes que\\b",
    "\\bsera\\b", "\\bseront\\b", "\\bpourra", "\\bsoient\\b", "\\bsoit\\b",
    "\\bif\\b", "\\bunless\\b", "\\buntil\\b", "\\bwill be\\b", "\\bwould\\b",
    "dettes?", "recouvrement", "souffrance", "revenu quebec", "\\bdebts?\\b",
    "gouvernement ouvert", "donnees ouvertes", "open government", "open data", "heures d'ouverture", "opening hours",
  ].join("|"),
);

const VERBE_ETAT =
  /\b(est|sont|is|are|a ete|ont ete|has been|have been)\s+(?:(maintenant|desormais|temporairement|now|currently|temporarily)\s+)?$/;

function statutsDeLigne(ligneNormalisee: string): string[] {
  const l = ligneNormalisee.replace(/[’‘]/g, "'");
  if (EXCLU_STATUT.test(l)) return [];
  const mots = l.split(/[^a-z0-9']+/).filter(Boolean);
  const out: string[] = [];
  for (const [re, statut] of STATUTS) {
    const m = re.exec(l);
    if (!m) continue;
    const avant = l.slice(0, m.index).split(/[^a-z0-9']+/).filter(Boolean).length;
    const enTete = avant === 0;
    const procheSujet = mots.some((mot, i) => SUJET_STATUT.test(mot) && Math.abs(i - avant) <= 6);
    const attributDuSujet = VERBE_ETAT.test(l.slice(0, m.index)) && mots.some((mot) => SUJET_STATUT.test(mot));
    if (enTete || procheSujet || attributDuSujet) out.push(statut);
  }
  return out;
}

/** Lignes de bruit (horodatage de page, pied de page) : jamais comparées. */
const BRUIT = /(modifi[ée]e? le|date de modification|mis[e]? à jour le|last updated|date modified|©|copyright|cookies?)/i;

const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** HTML → texte (balises, scripts et styles retirés, entités courantes décodées). */
export function texteDepuisHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/p|\/li|\/h\d|\/tr|\/div)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&#8217;/g, "’")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t\u00a0\u202f]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

function montantsDeLigne(ligne: string): string[] {
  const out: string[] = [];
  // « 5 000 $ », « 150 000 $ », « 2,75 G$ » (fr) ; « $5,000 », « $150,000 » (en)
  for (const m of ligne.matchAll(/(\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:,(\d+))?\s*(k|M|G)?\s*\$/g)) {
    const entier = Number(m[1].replace(/[ \u00a0\u202f]/g, ""));
    const dec = m[2] ? Number(`0.${m[2]}`) : 0;
    const mult = m[3] === "k" ? 1e3 : m[3] === "M" ? 1e6 : m[3] === "G" ? 1e9 : 1;
    out.push(String(Math.round((entier + dec) * mult)));
  }
  for (const m of ligne.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*(million|billion)?/gi)) {
    const entier = Number(m[1].replace(/,/g, ""));
    const dec = m[2] ? Number(`0.${m[2]}`) : 0;
    const mult = /million/i.test(m[3] ?? "") ? 1e6 : /billion/i.test(m[3] ?? "") ? 1e9 : 1;
    out.push(String(Math.round((entier + dec) * mult)));
  }
  return out;
}

function datesDeLigne(ligne: string): string[] {
  const out: string[] = [];
  for (const m of ligne.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.push(`${m[1]}-${m[2]}-${m[3]}`);
  const l = sansAccents(ligne.toLowerCase());
  // « 31 mars 2027 », « 1er avril 2026 »
  for (const m of l.matchAll(/\b(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})\b/g)) {
    out.push(`${m[3]}-${MOIS[m[2]]}-${m[1].padStart(2, "0")}`);
  }
  // « March 31, 2027 »
  for (const m of l.matchAll(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/g)) {
    out.push(`${m[3]}-${MOIS[m[1]]}-${m[2].padStart(2, "0")}`);
  }
  return out;
}

/** Faits surveillés d'un texte : montants en dollars, dates, mots de statut. */
export function faitsSurveilles(texte: string): Fait[] {
  const vus = new Set<string>();
  const faits: Fait[] = [];
  for (const brute of texte.split("\n")) {
    const ligne = brute.trim();
    if (!ligne || BRUIT.test(ligne)) continue;
    const extrait = ligne.length > 220 ? `${ligne.slice(0, 217)}…` : ligne;
    const ajouter = (type: TypeFait, valeur: string) => {
      const cle = `${type}:${valeur}`;
      if (vus.has(cle)) return;
      vus.add(cle);
      faits.push({ type, valeur, extrait });
    };
    for (const v of montantsDeLigne(ligne)) ajouter("montant", v);
    for (const v of datesDeLigne(ligne)) ajouter("date", v);
    for (const statut of statutsDeLigne(sansAccents(ligne.toLowerCase()))) ajouter("statut", statut);
  }
  return faits;
}

/** Empreinte courte et stable (FNV-1a 32 bits, hexadécimal). */
export function empreinte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Compare deux lectures d'une même source : une détection par type de
 * fait dont l'ensemble a changé (montants, dates, statuts), avec les
 * extraits avant → après. Première lecture (avant = null) : aucune
 * détection (état initial).
 */
export function comparerLectures(
  programmeId: string,
  url: string,
  avant: Fait[] | null,
  apres: Fait[],
): Detection[] {
  if (!avant) return [];
  const detections: Detection[] = [];
  for (const type of ["statut", "montant", "date"] as const) {
    const a = avant.filter((f) => f.type === type);
    const b = apres.filter((f) => f.type === type);
    const va = new Set(a.map((f) => f.valeur));
    const vb = new Set(b.map((f) => f.valeur));
    const ajoutes = b.filter((f) => !va.has(f.valeur));
    const retires = a.filter((f) => !vb.has(f.valeur));
    if (ajoutes.length === 0 && retires.length === 0) continue;
    const extraitsUniques = (fs: Fait[]) => [...new Set(fs.map((f) => f.extrait))].slice(0, 4).join("\n");
    detections.push({
      programmeId,
      url,
      type,
      ajoutes,
      retires,
      extraitAvant: extraitsUniques(retires),
      extraitApres: extraitsUniques(ajoutes),
      cleDedoublonnage: `${programmeId}:${type}:${empreinte(
        JSON.stringify([retires.map((f) => f.valeur).sort(), ajoutes.map((f) => f.valeur).sort()]),
      )}`,
    });
  }
  return detections;
}
