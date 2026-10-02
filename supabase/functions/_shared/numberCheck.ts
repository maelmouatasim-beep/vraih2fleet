/**
 * Vérification des nombres d'un texte généré (Phase 5, règle non
 * négociable : « l'IA ne produit JAMAIS un chiffre »).
 *
 * Chaque nombre CITÉ dans la réponse (montant, %, tonnes, année, compte…)
 * doit correspondre à une valeur présente dans le CORPUS autorisé : les
 * sorties des outils appelés pendant le tour (moteur TCO, optimiseur,
 * registres), les données du projet transmises et les messages de
 * l'utilisateur. Tolérance = arrondi affiché seulement (« 46 112 $ » pour
 * 46 112,37 ; « 1,5 M$ » pour 1 512 000 ; « 25 % » pour 0,25).
 *
 * Module PUR (aucune API Deno) : importé par la fonction `copilot` et par
 * les tests (Deno et Vitest).
 */

export type Langue = "fr" | "en";

export interface NombreCite {
  brut: string;
  valeur: number;
  /** Pas d'arrondi affiché (1 pour « 46 112 », 0,1 pour « 2,5 », 100 000 pour « 1,5 M$ »). */
  pas: number;
  pourcent: boolean;
}

export interface ResultatVerification {
  ok: boolean;
  /** Nombres cités introuvables dans le corpus. */
  nonVerifies: string[];
  /** Nombre de valeurs vérifiées. */
  verifies: number;
}

const MULTIPLICATEURS: Record<string, number> = {
  k: 1e3,
  M: 1e6,
  G: 1e9,
  millier: 1e3,
  milliers: 1e3,
  million: 1e6,
  millions: 1e6,
  milliard: 1e9,
  milliards: 1e9,
  thousand: 1e3,
  thousands: 1e3,
  billion: 1e9,
  billions: 1e9,
};

const ESPACES = "[ \\u00a0\\u202f\\u2009]";

function motifNombre(langue: Langue): RegExp {
  const entier =
    langue === "fr"
      ? `\\d{1,3}(?:${ESPACES}\\d{3})+|\\d+`
      : `\\d{1,3}(?:,\\d{3})+|\\d+`;
  const decimale = langue === "fr" ? "[.,]" : "\\.";
  return new RegExp(
    `(${entier})(?:${decimale}(\\d+))?` +
      `(?:${ESPACES}?(k|M|G|milliers?|millions?|milliards?|thousands?|billions?)(?=[^\\p{L}]|$))?` +
      `(${ESPACES}?%)?`,
    "gu",
  );
}

/** Retire les marqueurs de liste numérotée (« 1. », « 2) ») en début de ligne. */
function sansMarqueursDeListe(texte: string): string {
  return texte.replace(/^(\s*(?:#+\s*)?)\d+[.)](?=\s)/gmu, "$1");
}

/** Dates ISO (AAAA-MM-JJ) : vérifiées comme chaînes exactes, retirées du texte. */
const DATE_ISO = /\b\d{4}-\d{2}-\d{2}\b/g;

export function extraireNombres(texte: string, langue: Langue): { nombres: NombreCite[]; dates: string[] } {
  const dates = texte.match(DATE_ISO) ?? [];
  const nettoye = sansMarqueursDeListe(texte.replace(DATE_ISO, " "));
  const nombres: NombreCite[] = [];
  const re = motifNombre(langue);
  for (const m of nettoye.matchAll(re)) {
    const debut = m.index ?? 0;
    const avant = nettoye.slice(Math.max(0, debut - 2), debut);
    // Identifiants (C-01, HV-01, CO2, classe 2b, kWh…) : pas des nombres cités.
    if (/\p{L}$/u.test(avant) || /\p{L}[-‑_/]$/u.test(avant) || /[\d.,_]$/u.test(avant)) continue;
    const fin = debut + m[0].length;
    const apres = nettoye.slice(fin, fin + 1);
    if (!m[3] && !m[4] && /\p{L}/u.test(apres) && !/^\s/u.test(apres)) continue;
    const entier = m[1].replace(/[ \u00a0\u202f\u2009,]/g, "");
    const decimales = m[2] ?? "";
    let valeur = Number(`${entier}${decimales ? "." + decimales : ""}`);
    let pas = decimales ? Math.pow(10, -decimales.length) : 1;
    if (m[3]) {
      const mult = MULTIPLICATEURS[m[3]] ?? 1;
      valeur *= mult;
      pas *= mult;
    }
    if (!Number.isFinite(valeur)) continue;
    nombres.push({ brut: m[0].trim(), valeur, pas, pourcent: !!m[4] });
  }
  return { nombres, dates };
}

/** Valeurs numériques d'un corpus : nombres JSON, nombres écrits dans les
 *  chaînes (dans les deux conventions) et composantes des dates ISO. */
export function valeursDuCorpus(...sources: unknown[]): { valeurs: number[]; dates: Set<string> } {
  const valeurs: number[] = [];
  const dates = new Set<string>();
  const parcourir = (x: unknown) => {
    if (typeof x === "number") {
      if (Number.isFinite(x)) valeurs.push(x);
    } else if (typeof x === "string") {
      for (const d of x.match(DATE_ISO) ?? []) {
        dates.add(d);
        const [a, mo, j] = d.split("-").map(Number);
        valeurs.push(a, mo, j);
      }
      for (const langue of ["fr", "en"] as const) {
        for (const n of extraireNombres(x, langue).nombres) valeurs.push(n.pourcent ? n.valeur : n.valeur);
      }
      // Les chaînes JSON imbriquées (résultats d'outils sérialisés) sont relues.
      const t = x.trim();
      if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
        try {
          parcourir(JSON.parse(t));
        } catch {
          // texte libre : déjà lu ci-dessus
        }
      }
    } else if (Array.isArray(x)) {
      for (const e of x) parcourir(e);
    } else if (x && typeof x === "object") {
      for (const v of Object.values(x as Record<string, unknown>)) parcourir(v);
    }
  };
  for (const s of sources) parcourir(s);
  return { valeurs, dates };
}

function correspond(n: NombreCite, valeurs: number[]): boolean {
  const cible = Math.abs(n.valeur);
  const tol = n.pas * 0.5 + 1e-9 * Math.max(1, cible);
  // tolère aussi la troncature (« 46 k$ » pour 46 900) : jusqu'à un pas entier
  const tolTronc = n.pas + 1e-9 * Math.max(1, cible);
  for (const v of valeurs) {
    const a = Math.abs(v);
    const candidats = n.pourcent ? [a, a * 100] : [a];
    for (const c of candidats) {
      if (Math.abs(c - cible) <= tol) return true;
      if (c >= cible && c - cible < tolTronc && n.pas >= 1000) return true;
    }
  }
  return false;
}

export function verifierNombres(texte: string, langue: Langue, ...corpus: unknown[]): ResultatVerification {
  const { valeurs, dates } = valeursDuCorpus(...corpus);
  const { nombres, dates: datesCitees } = extraireNombres(texte, langue);
  const nonVerifies: string[] = [];
  let verifies = 0;
  for (const d of datesCitees) {
    if (dates.has(d)) verifies++;
    else nonVerifies.push(d);
  }
  for (const n of nombres) {
    if (correspond(n, valeurs)) verifies++;
    else nonVerifies.push(n.brut);
  }
  return { ok: nonVerifies.length === 0, nonVerifies: [...new Set(nonVerifies)], verifies };
}
