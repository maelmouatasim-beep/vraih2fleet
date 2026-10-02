/**
 * Phase 5, point 3 — IMPORT INTELLIGENT de flotte (logique PURE, testée).
 *
 * N'importe quel inventaire (Excel, CSV, PDF, export d'un logiciel de
 * gestion de flotte) devient un TABLEAU BRUT de cellules texte (lecture
 * déterministe : ./smartImportFile.ts). L'IA ne voit que les ENTÊTES et
 * quelques valeurs d'exemple ; elle propose seulement une
 * CORRESPONDANCE : quelle colonne alimente quel champ du modèle, quel
 * libellé correspond à quelle catégorie / carburant / classe PNBV, quelle
 * unité utilise une colonne. Elle ne transcrit ni ne calcule AUCUNE
 * valeur : le code applique la correspondance aux cellules du fichier,
 * puis la validation stricte de l'import (./importVehicles.ts).
 *
 * Aucune valeur inventée : une colonne ou un libellé incertain n'est PAS
 * appliqué — le champ reste vide et la ligne est signalée.
 * Minimisation (Loi 25) : les colonnes de données personnelles
 * (conducteur, courriel, téléphone…) sont détectées et jamais transmises.
 */
import { CLASSES_PNBV, lireClassePnbv } from "./gvwr";
import { CARBURANTS, CATEGORIES_VEHICULE, PROFILS_USAGE, STATUTS_VEHICULE } from "./constants";
import { champPourEntete, validerLignes, valeurReconnue, type ResultatImport } from "./importVehicles";
import { DEFAUTS_CATEGORIES } from "@/lib/tco";
import { categorieMoteur } from "@/lib/journey/categories";
import { cleGarage } from "@/lib/journey/infrastructure";
import type { ChangementJournal } from "@/lib/journey/changeLog";

export const CHAMPS_IMPORT = [
  "unit_number",
  "vin",
  "make",
  "model",
  "model_year",
  "in_service_date",
  "category",
  "fuel_type",
  "annual_km",
  "consumption_per_100km",
  "usage_profile",
  "department",
  "depot",
  "gvwr_class",
  "max_daily_km",
  "status",
  "notes",
] as const;
export type ChampImport = (typeof CHAMPS_IMPORT)[number];
export type CibleColonne = ChampImport | "ignorer";

/** Champs à choix fermé dont les libellés peuvent être associés par l'IA. */
export const CHAMPS_A_CHOIX = ["category", "fuel_type", "gvwr_class", "usage_profile", "status"] as const;
export type ChampAChoix = (typeof CHAMPS_A_CHOIX)[number];

export const VALEURS_CIBLES: Record<ChampAChoix, readonly string[]> = {
  category: CATEGORIES_VEHICULE,
  fuel_type: CARBURANTS,
  gvwr_class: CLASSES_PNBV,
  usage_profile: PROFILS_USAGE,
  status: STATUTS_VEHICULE,
};

/** Unités reconnues pour la conversion (facteurs EXACTS par définition). */
export const UNITES = ["km", "mi", "L/100km", "mpg_us", "mpg_imp", "km/L"] as const;
export type Unite = (typeof UNITES)[number];
const KM_PAR_MILLE = 1.609344; // mille international (définition exacte)
const L_PAR_GALLON_US = 3.785411784; // définition exacte
const L_PAR_GALLON_IMP = 4.54609; // définition exacte

export type Certitude = "sure" | "probable" | "incertaine";
export type Origine = "synonyme" | "ia" | "utilisateur";

export interface TableauBrut {
  source: "csv" | "xlsx" | "pdf";
  entetes: string[];
  lignes: string[][];
  /** Lignes du document qui n'ont pas pu être alignées sur les colonnes (PDF). */
  lignesNonReconnues: number;
}

export interface ColonneCorrespondance {
  index: number;
  entete: string;
  champ: CibleColonne;
  certitude: Certitude;
  origine: Origine;
  /** Colonne de données personnelles : jamais transmise, jamais importée. */
  personnelle?: boolean;
  unite?: Unite;
}

export interface ValeurCorrespondance {
  champ: ChampAChoix;
  source: string;
  /** Valeur canonique ; "" = aucune correspondance sûre. */
  cible: string;
  certitude: Certitude;
  origine: Origine;
}

export interface Correspondance {
  colonnes: ColonneCorrespondance[];
  valeurs: ValeurCorrespondance[];
}

// ---------------------------------------------------------------------------
// Lecture : détection de l'entête dans une grille
// ---------------------------------------------------------------------------

const estNombre = (s: string) => /^-?[\d\s\u00a0\u202f.,]+$/.test(s.trim()) && /\d/.test(s);

/** Ligne d'entête : parmi les 15 premières, celle qui a le plus de cellules
 *  texte non vides (≥ 2), à égalité la première. */
export function detecterEntete(grille: string[][]): number {
  let meilleure = 0;
  let score = -1;
  grille.slice(0, 15).forEach((ligne, i) => {
    const texte = ligne.filter((c) => c.trim() !== "" && !estNombre(c)).length;
    if (texte >= 2 && texte > score) {
      score = texte;
      meilleure = i;
    }
  });
  return meilleure;
}

/** Grille → tableau (entêtes + lignes non vides alignées sur les entêtes). */
export function tableauDepuisGrille(grille: string[][], source: TableauBrut["source"]): TableauBrut {
  const i = detecterEntete(grille);
  const entetes = (grille[i] ?? []).map((c, j) => c.trim() || `Colonne ${j + 1}`);
  const lignes: string[][] = [];
  for (const ligne of grille.slice(i + 1)) {
    if (ligne.every((c) => c.trim() === "")) continue;
    lignes.push(entetes.map((_, j) => (ligne[j] ?? "").trim()));
  }
  return { source, entetes, lignes, lignesNonReconnues: 0 };
}

export interface ElementTextePdf {
  texte: string;
  x: number;
  y: number;
  largeur: number;
  page: number;
}

/**
 * PDF → grille, déterministe : les éléments de texte sont regroupés en
 * lignes (même ordonnée, tolérance), puis chaque cellule est rattachée à
 * l'entête qu'elle chevauche le plus horizontalement (la plus proche à
 * défaut) — entêtes centrées ou alignées à gauche. Les
 * lignes qui n'ont pas au moins deux cellules alignées sont comptées comme
 * non reconnues — jamais devinées.
 */
export function grilleDepuisPdf(elements: ElementTextePdf[]): { grille: string[][]; lignesNonReconnues: number } {
  const tri = [...elements].filter((e) => e.texte.trim() !== "").sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lignes: ElementTextePdf[][] = [];
  for (const e of tri) {
    const derniere = lignes[lignes.length - 1];
    if (derniere && derniere[0].page === e.page && Math.abs(derniere[0].y - e.y) <= 3) derniere.push(e);
    else lignes.push([e]);
  }
  // Fusion des fragments contigus d'une même cellule (écart < 4 pt).
  const cellules = lignes.map((l) => {
    const triee = [...l].sort((a, b) => a.x - b.x);
    const out: { texte: string; x: number; fin: number }[] = [];
    for (const e of triee) {
      const prec = out[out.length - 1];
      if (prec && e.x - prec.fin < 4) {
        prec.texte = `${prec.texte}${e.x - prec.fin > 1 ? " " : ""}${e.texte}`.trim();
        prec.fin = e.x + e.largeur;
      } else {
        out.push({ texte: e.texte.trim(), x: e.x, fin: e.x + e.largeur });
      }
    }
    return out;
  });
  const grilleTexte = cellules.map((l) => l.map((c) => c.texte));
  const iEntete = detecterEntete(grilleTexte);
  const entete = cellules[iEntete] ?? [];
  if (entete.length < 2) return { grille: grilleTexte, lignesNonReconnues: 0 };
  // Colonne d'une cellule : l'entête dont l'étendue horizontale la
  // chevauche le plus (entêtes centrées ou alignées à gauche) ; sans
  // chevauchement, l'entête la plus proche.
  const colonneDe = (x: number, fin: number) => {
    let meilleure = 0;
    let recouvrement = 0;
    let distance = Infinity;
    entete.forEach((h, j) => {
      const r = Math.min(fin, h.fin) - Math.max(x, h.x);
      const d = r > 0 ? 0 : Math.max(h.x - fin, x - h.fin);
      if (r > recouvrement || (recouvrement === 0 && r <= 0 && d < distance)) {
        meilleure = j;
        recouvrement = Math.max(r, 0);
        distance = d;
      }
    });
    return meilleure;
  };
  const grille: string[][] = [entete.map((c) => c.texte)];
  let nonReconnues = 0;
  for (const ligne of cellules.slice(iEntete + 1)) {
    const rangee = new Array<string>(entete.length).fill("");
    for (const c of ligne) {
      const j = colonneDe(c.x, c.fin);
      rangee[j] = rangee[j] ? `${rangee[j]} ${c.texte}` : c.texte;
    }
    if (rangee.filter((c) => c !== "").length < 2) {
      nonReconnues++;
      continue;
    }
    // Entête répétée sur une nouvelle page : ignorée.
    if (rangee.join("|") === grille[0].join("|")) continue;
    grille.push(rangee);
  }
  return { grille, lignesNonReconnues: nonReconnues };
}

// ---------------------------------------------------------------------------
// Minimisation et correspondance déterministe
// ---------------------------------------------------------------------------

const MOTS_PERSONNELS = new Set([
  "conducteur", "conductrice", "chauffeur", "driver", "employe", "employee", "operateur", "operator",
  "nom", "name", "prenom", "firstname", "lastname", "courriel", "email", "mail", "telephone", "phone",
  "tel", "cellulaire", "mobile", "matricule", "adresse", "address", "permis", "licence", "license",
]);
const MOTS_VEHICULE = new Set(["unite", "unit", "vehicule", "vehicle", "modele", "model", "garage", "depot"]);

const jetons = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Entête d'une colonne de données personnelles (jamais transmise ni importée). */
export function estColonnePersonnelle(entete: string): boolean {
  const j = jetons(entete);
  if (j.some((x) => MOTS_VEHICULE.has(x))) return false;
  return j.some((x) => MOTS_PERSONNELS.has(x));
}

/** Correspondance de départ : synonymes connus (sans IA). */
export function correspondanceInitiale(t: TableauBrut): Correspondance {
  const dejaPris = new Set<string>();
  const colonnes = t.entetes.map((entete, index): ColonneCorrespondance => {
    if (estColonnePersonnelle(entete)) {
      return { index, entete, champ: "ignorer", certitude: "sure", origine: "synonyme", personnelle: true };
    }
    const reconnu = champPourEntete(entete);
    const champ = (CHAMPS_IMPORT as readonly string[]).includes(reconnu ?? "") ? (reconnu as ChampImport) : null;
    if (champ && !dejaPris.has(champ)) {
      dejaPris.add(champ);
      return { index, entete, champ, certitude: "sure", origine: "synonyme" };
    }
    return { index, entete, champ: "ignorer", certitude: "incertaine", origine: "synonyme" };
  });
  return { colonnes, valeurs: [] };
}

export interface ColonnePourIa {
  entete: string;
  exemples: string[];
  /** Toutes les valeurs distinctes si elles sont peu nombreuses (≤ 30). */
  valeursDistinctes: string[] | null;
  nbValeurs: number;
}

/** Ce qui est transmis à l'IA : entêtes, 3 exemples et valeurs distinctes
 *  (colonnes catégorielles) — jamais les colonnes personnelles ni le
 *  fichier entier. */
export function colonnesPourIa(t: TableauBrut, c: Correspondance): ColonnePourIa[] {
  return c.colonnes
    .filter((col) => !col.personnelle)
    .map((col) => {
      const valeurs = t.lignes.map((l) => l[col.index] ?? "").filter((v) => v !== "");
      const distinctes = [...new Set(valeurs)];
      return {
        entete: col.entete.slice(0, 80),
        exemples: distinctes.slice(0, 3).map((v) => v.slice(0, 40)),
        valeursDistinctes: distinctes.length <= 30 ? distinctes.map((v) => v.slice(0, 40)) : null,
        nbValeurs: valeurs.length,
      };
    });
}

/** Fusionne la proposition de l'IA : jamais sur une colonne personnelle,
 *  jamais au-dessus d'un choix de l'utilisateur, un champ par colonne. */
export function fusionnerPropositionIa(
  base: Correspondance,
  proposition: {
    colonnes: { entete: string; champ: CibleColonne; certitude: Certitude; unite?: Unite | "" }[];
    valeurs: { champ: ChampAChoix; source: string; cible: string; certitude: Certitude }[];
  },
): Correspondance {
  const colonnes = base.colonnes.map((col) => {
    if (col.personnelle || col.origine === "utilisateur") return col;
    const p = proposition.colonnes.find((x) => x.entete === col.entete.slice(0, 80));
    if (!p) return col;
    // Un synonyme sûr n'est remplacé que par une proposition sûre.
    if (col.origine === "synonyme" && col.certitude === "sure" && p.certitude !== "sure") {
      return { ...col, unite: p.unite || col.unite };
    }
    return { ...col, champ: p.champ, certitude: p.certitude, origine: "ia" as const, unite: p.unite || undefined };
  });
  // Un même champ ne peut venir que d'une colonne : la plus sûre l'emporte.
  const rang: Record<Certitude, number> = { sure: 0, probable: 1, incertaine: 2 };
  const parChamp = new Map<string, ColonneCorrespondance>();
  for (const col of colonnes) {
    if (col.champ === "ignorer") continue;
    const deja = parChamp.get(col.champ);
    if (!deja || rang[col.certitude] < rang[deja.certitude]) parChamp.set(col.champ, col);
  }
  const finales = colonnes.map((col) =>
    col.champ !== "ignorer" && parChamp.get(col.champ) !== col ? { ...col, champ: "ignorer" as const, certitude: "incertaine" as const } : col,
  );
  const valeurs = proposition.valeurs
    .filter((v) => (CHAMPS_A_CHOIX as readonly string[]).includes(v.champ))
    .map((v) => ({
      ...v,
      cible: VALEURS_CIBLES[v.champ].includes(v.cible) ? v.cible : "",
      origine: "ia" as const,
    }));
  return { colonnes: finales, valeurs: [...base.valeurs.filter((v) => v.origine === "utilisateur"), ...valeurs] };
}

// ---------------------------------------------------------------------------
// Application déterministe
// ---------------------------------------------------------------------------

function nombreStrict(brut: string): number | null {
  const s = brut.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  const m = s.match(/^(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** Conversion d'unité EXACTE (définitions légales), arrondie au centième. */
export function convertir(valeur: number, unite: Unite | undefined, champ: ChampImport): number {
  const r = (x: number) => Math.round(x * 100) / 100;
  if (!unite) return valeur;
  if (champ === "annual_km" || champ === "max_daily_km") return unite === "mi" ? r(valeur * KM_PAR_MILLE) : valeur;
  if (champ === "consumption_per_100km") {
    if (valeur <= 0) return valeur;
    if (unite === "mpg_us") return r((100 * L_PAR_GALLON_US) / (valeur * KM_PAR_MILLE));
    if (unite === "mpg_imp") return r((100 * L_PAR_GALLON_IMP) / (valeur * KM_PAR_MILLE));
    if (unite === "km/L") return r(100 / valeur);
  }
  return valeur;
}

export type Signalement =
  | { code: "colonne_incertaine"; entete: string }
  | { code: "colonne_personnelle"; entete: string }
  | { code: "valeur_incertaine"; champ: ChampAChoix; valeur: string }
  | { code: "unite_convertie"; champ: ChampImport; unite: Unite }
  | { code: "doublon_probable"; avec: string }
  | { code: "niv_double"; avec: string }
  | { code: "annee_future"; annee: number }
  | { code: "mise_en_service_avant_modele"; annee: number; modele: number }
  | { code: "km_incoherents"; kmAn: number; kmJourMax: number }
  | { code: "conso_a_verifier"; conso: number; reference: number }
  | { code: "garage_nouveau"; garage: string };

export interface LigneValidation {
  ligne: number;
  unite: string;
  statut: "nouveau" | "mise_a_jour" | "erreur" | "exclue";
  valeurs: Partial<Record<ChampImport, string>>;
  erreurs: { champ: string; message: string }[];
  signalements: Signalement[];
}

export interface ResultatImportIntelligent {
  import: ResultatImport;
  lignes: LigneValidation[];
  signalementsGlobaux: Signalement[];
  garagesNouveaux: string[];
}

/** Borne PHYSIQUE (jours d'une année civile), pas une hypothèse
 *  d'exploitation : un km annuel au-delà de 365 × km journalier max est
 *  impossible. */
const JOURS_CALENDAIRES = 365;

const cleUnite = (u: string) => u.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^([a-z]*)0+(\d)/, "$1$2");

/** Applique la correspondance, valide (règles strictes de l'import) et
 *  signale doublons et incohérences. PURE. `surcharges` = corrections
 *  saisies par l'utilisateur dans le tableau de validation (ligne → champ). */
export function appliquerCorrespondance(
  t: TableauBrut,
  c: Correspondance,
  contexte: {
    organizationId: string;
    existants: { id: string; unit_number: string; vin?: string | null }[];
    garagesExistants: string[];
    anneeCourante: number;
    surcharges?: Record<number, Partial<Record<ChampImport, string>>>;
    /** Ligne (1 = première ligne de données) → importée ou non. */
    choixLignes?: Record<number, boolean>;
  },
): ResultatImportIntelligent {
  const signalementsGlobaux: Signalement[] = [];
  for (const col of c.colonnes) {
    if (col.personnelle) signalementsGlobaux.push({ code: "colonne_personnelle", entete: col.entete });
    else if (col.champ === "ignorer" && col.certitude === "incertaine") signalementsGlobaux.push({ code: "colonne_incertaine", entete: col.entete });
  }
  const actives = c.colonnes.filter((col) => col.champ !== "ignorer" && col.certitude !== "incertaine" && !col.personnelle);
  for (const col of actives) {
    if (col.unite && col.unite !== "km" && col.unite !== "L/100km") {
      signalementsGlobaux.push({ code: "unite_convertie", champ: col.champ as ChampImport, unite: col.unite });
    }
  }
  const garagesParCle = new Map(contexte.garagesExistants.map((g) => [cleGarage(g), g]));
  const garagesNouveaux = new Map<string, string>();

  const lignesBrutes: Record<string, unknown>[] = [];
  const signalementsParLigne: Signalement[][] = [];
  t.lignes.forEach((cellules, i) => {
    const sign: Signalement[] = [];
    const ligne: Record<string, unknown> = {};
    for (const col of actives) {
      const champ = col.champ as ChampImport;
      let brut = (cellules[col.index] ?? "").trim();
      if (brut === "") continue;
      if ((CHAMPS_A_CHOIX as readonly string[]).includes(champ)) {
        const ch = champ as ChampAChoix;
        const reconnu =
          ch === "gvwr_class" ? lireClassePnbv(brut) : valeurReconnue(ch as Exclude<ChampAChoix, "gvwr_class">, brut);
        if (!reconnu) {
          const v = c.valeurs.find((x) => x.champ === ch && x.source === brut);
          if (v && v.cible && v.certitude !== "incertaine") brut = v.cible;
          else {
            sign.push({ code: "valeur_incertaine", champ: ch, valeur: brut });
            continue; // champ laissé VIDE, jamais deviné
          }
        }
      }
      if (champ === "annual_km" || champ === "max_daily_km" || champ === "consumption_per_100km") {
        const n = nombreStrict(brut);
        if (n != null && col.unite) brut = String(convertir(n, col.unite, champ));
      }
      if (champ === "depot") {
        const existant = garagesParCle.get(cleGarage(brut));
        if (existant) brut = existant;
        else garagesNouveaux.set(cleGarage(brut), brut.replace(/\s+/g, " "));
      }
      ligne[champ] = brut;
    }
    for (const [champ, valeur] of Object.entries(contexte.surcharges?.[i + 1] ?? {})) {
      if (valeur != null) ligne[champ] = valeur;
    }
    lignesBrutes.push(ligne);
    signalementsParLigne.push(sign);
  });

  // Doublons probables et incohérences (signalés, jamais corrigés d'office).
  const cles = new Map<string, string>();
  for (const v of contexte.existants) cles.set(cleUnite(v.unit_number), v.unit_number);
  const vins = new Map<string, string>();
  for (const v of contexte.existants) if (v.vin) vins.set(v.vin.trim().toUpperCase(), v.unit_number);
  const doublon = lignesBrutes.map((l, i) => {
    const unite = String(l.unit_number ?? "").trim();
    const sign = signalementsParLigne[i];
    let est = false;
    const cle = cleUnite(unite);
    const deja = cles.get(cle);
    if (unite && deja && deja !== unite) {
      sign.push({ code: "doublon_probable", avec: deja });
      est = true;
    }
    if (unite && !deja) cles.set(cle, unite);
    const vin = String(l.vin ?? "").trim().toUpperCase();
    if (vin) {
      const autre = vins.get(vin);
      if (autre && autre !== unite) {
        sign.push({ code: "niv_double", avec: autre });
        est = true;
      } else vins.set(vin, unite);
    }
    return est;
  });
  // Une ligne signalée comme doublon est EXCLUE par défaut ; l'utilisateur
  // peut la réintégrer (ou exclure toute autre ligne).
  const incluse = (i: number) => contexte.choixLignes?.[i + 1] ?? !doublon[i];

  const existantes = new Map(contexte.existants.map((v) => [v.unit_number, v.id]));
  const resultat = validerLignes(
    lignesBrutes.map((l, i) => (incluse(i) ? l : {})),
    contexte.organizationId,
    existantes,
  );

  const lignes: LigneValidation[] = lignesBrutes.map((l, i) => {
    const n = i + 1;
    const unite = String(l.unit_number ?? "").trim();
    const erreurs = resultat.erreurs.filter((e) => e.ligne === n).map((e) => ({ champ: e.champ, message: e.message }));
    const sign = signalementsParLigne[i];
    const annee = nombreStrict(String(l.model_year ?? ""));
    if (annee != null && annee > contexte.anneeCourante + 1) sign.push({ code: "annee_future", annee });
    const service = String(l.in_service_date ?? "").match(/^(\d{4})/);
    if (service && annee != null && Number(service[1]) < annee - 1) {
      sign.push({ code: "mise_en_service_avant_modele", annee: Number(service[1]), modele: annee });
    }
    const kmAn = nombreStrict(String(l.annual_km ?? ""));
    const kmJour = nombreStrict(String(l.max_daily_km ?? ""));
    if (kmAn != null && kmJour != null && kmJour > 0 && kmJour * JOURS_CALENDAIRES < kmAn) sign.push({ code: "km_incoherents", kmAn, kmJourMax: kmJour });
    const conso = nombreStrict(String(l.consumption_per_100km ?? ""));
    const brutCat = String(l.category ?? "");
    const cat = categorieMoteur(valeurReconnue("category", brutCat) ?? brutCat);
    const ref = cat ? DEFAUTS_CATEGORIES[cat].consommation.diesel.valeur : null;
    const fuel = valeurReconnue("fuel_type", String(l.fuel_type ?? ""));
    if (conso != null && ref && (fuel === "diesel" || fuel === "essence") && (conso > ref * 3 || conso < ref / 3)) {
      sign.push({ code: "conso_a_verifier", conso, reference: ref });
    }
    const valeurs: Partial<Record<ChampImport, string>> = {};
    for (const champ of CHAMPS_IMPORT) if (l[champ] != null && l[champ] !== "") valeurs[champ] = String(l[champ]);
    const statut: LigneValidation["statut"] = !incluse(i)
      ? "exclue"
      : erreurs.length > 0
        ? "erreur"
        : existantes.has(unite)
          ? "mise_a_jour"
          : "nouveau";
    return { ligne: n, unite, statut, valeurs, erreurs, signalements: sign };
  });

  return {
    import: resultat,
    lignes,
    signalementsGlobaux,
    garagesNouveaux: [...garagesNouveaux.values()],
  };
}

// ---------------------------------------------------------------------------
// Aperçu avant → après et journal
// ---------------------------------------------------------------------------

/** Changements réels (avant → après) d'un import : création de véhicule,
 *  ou champs modifiés d'une unité existante (les champs identiques ne
 *  sont pas listés). Sert à l'aperçu ET au journal. Aucun nom de
 *  personne : les colonnes personnelles ne sont jamais lues. */
export function changementsImport(
  r: ResultatImport,
  existants: Array<{ id: string; unit_number: string } & Record<string, unknown>>,
): ChangementJournal[] {
  const parId = new Map(existants.map((v) => [v.id, v]));
  const out: ChangementJournal[] = [];
  for (const v of r.valides) {
    out.push({ cible: v.unit_number, champ: "vehicule", avant: null, apres: `${v.category} · ${v.fuel_type}` });
  }
  for (const m of r.misesAJour) {
    const avant = parId.get(m.id) ?? {};
    for (const [champ, apres] of Object.entries(m.patch)) {
      if (champ === "organization_id" || champ === "unit_number" || apres === undefined) continue;
      const a = (avant as Record<string, unknown>)[champ];
      const norm = (x: unknown) => (x == null || x === "" ? null : String(x));
      if (norm(a) === norm(apres)) continue;
      out.push({
        cible: m.unit_number,
        champ,
        avant: a == null ? null : (a as string | number),
        apres: apres == null ? null : (apres as string | number),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Corrections de l'utilisateur dans l'écran de correspondance
// ---------------------------------------------------------------------------

/** L'utilisateur associe une colonne à un champ (ou l'ignore) : choix sûr,
 *  qui libère toute autre colonne associée au même champ. Une colonne
 *  personnelle reste exclue. */
export function choisirChamp(c: Correspondance, index: number, champ: CibleColonne): Correspondance {
  const colonnes = c.colonnes.map((col) => {
    if (col.personnelle) return col;
    if (col.index === index) {
      const unite = champ === "annual_km" || champ === "max_daily_km" || champ === "consumption_per_100km" ? col.unite : undefined;
      return { ...col, champ, certitude: "sure" as const, origine: "utilisateur" as const, unite };
    }
    if (champ !== "ignorer" && col.champ === champ) return { ...col, champ: "ignorer" as const, certitude: "sure" as const, origine: "utilisateur" as const };
    return col;
  });
  return { ...c, colonnes };
}

export function choisirUnite(c: Correspondance, index: number, unite: Unite | undefined): Correspondance {
  return { ...c, colonnes: c.colonnes.map((col) => (col.index === index ? { ...col, unite } : col)) };
}

/** L'utilisateur associe un libellé du fichier à une valeur du modèle ("" = aucune). */
export function choisirValeur(c: Correspondance, champ: ChampAChoix, source: string, cible: string): Correspondance {
  const valide = cible === "" || VALEURS_CIBLES[champ].includes(cible);
  const v: ValeurCorrespondance = {
    champ,
    source,
    cible: valide ? cible : "",
    certitude: valide && cible !== "" ? "sure" : "incertaine",
    origine: "utilisateur",
  };
  return { ...c, valeurs: [...c.valeurs.filter((x) => !(x.champ === champ && x.source === source)), v] };
}

/** Libellés distincts des colonnes à choix qui ne sont PAS reconnus par les
 *  synonymes : à associer (par l'IA ou l'utilisateur), sinon laissés vides. */
export function valeursAAssocier(t: TableauBrut, c: Correspondance): ValeurCorrespondance[] {
  const out: ValeurCorrespondance[] = [];
  for (const col of c.colonnes) {
    if (col.personnelle || col.champ === "ignorer" || col.certitude === "incertaine") continue;
    if (!(CHAMPS_A_CHOIX as readonly string[]).includes(col.champ)) continue;
    const champ = col.champ as ChampAChoix;
    const vus = new Set<string>();
    for (const l of t.lignes) {
      const brut = (l[col.index] ?? "").trim();
      if (!brut || vus.has(brut)) continue;
      vus.add(brut);
      const reconnu = champ === "gvwr_class" ? lireClassePnbv(brut) : valeurReconnue(champ, brut);
      if (reconnu) continue;
      out.push(
        c.valeurs.find((v) => v.champ === champ && v.source === brut) ?? { champ, source: brut, cible: "", certitude: "incertaine", origine: "synonyme" },
      );
    }
  }
  return out;
}
