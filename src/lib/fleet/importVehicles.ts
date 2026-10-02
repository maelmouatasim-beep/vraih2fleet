/**
 * Import de flotte depuis CSV/Excel — validation ligne par ligne.
 * Fonctions PURES (testées) : le fichier est d'abord transformé en
 * lignes {entête → valeur}, puis chaque ligne est normalisée et validée
 * (zod). Aucune ligne invalide n'est importée ; chaque erreur cite la
 * ligne, le champ et la raison.
 */
import { z } from "zod";
import Papa from "papaparse";
import {
  CARBURANTS,
  CATEGORIES_VEHICULE,
  PROFILS_USAGE,
  SOURCES_CONSOMMATION,
  STATUTS_VEHICULE,
} from "./constants";
// import type seulement : effacé à la compilation, le client Supabase
// n'est jamais chargé par ce module (testable sans environnement)
import type { VehicleInsert } from "./vehicles";
import { CLASSES_PNBV, lireClassePnbv } from "./gvwr";

// ---------------------------------------------------------------------------
// Correspondance des entêtes (fr/en, accents et espaces ignorés)
// ---------------------------------------------------------------------------
const ENTETES: Record<string, string> = {
  // clé normalisée → champ
  numerodunite: "unit_number",
  numerounite: "unit_number",
  unite: "unit_number",
  unit: "unit_number",
  unitnumber: "unit_number",
  vin: "vin",
  marque: "make",
  make: "make",
  modele: "model",
  model: "model",
  annee: "model_year",
  anneemodele: "model_year",
  year: "model_year",
  modelyear: "model_year",
  miseenservice: "in_service_date",
  datemiseenservice: "in_service_date",
  inservicedate: "in_service_date",
  categorie: "category",
  category: "category",
  classe: "category",
  carburant: "fuel_type",
  fuel: "fuel_type",
  fueltype: "fuel_type",
  kman: "annual_km",
  kmparan: "annual_km",
  kmannuel: "annual_km",
  annualkm: "annual_km",
  consommation: "consumption_per_100km",
  conso: "consumption_per_100km",
  consumption: "consumption_per_100km",
  sourceconsommation: "consumption_source",
  consumptionsource: "consumption_source",
  usage: "usage_profile",
  trajet: "usage_profile",
  usageprofile: "usage_profile",
  departement: "department",
  department: "department",
  depot: "depot",
  garage: "depot",
  kmjournaliermax: "max_daily_km",
  kmjourmax: "max_daily_km",
  kmmaxparjour: "max_daily_km",
  kmparjourmax: "max_daily_km",
  maxdailykm: "max_daily_km",
  maxkmperday: "max_daily_km",
  classepnbv: "gvwr_class",
  pnbv: "gvwr_class",
  classepoids: "gvwr_class",
  classedepoids: "gvwr_class",
  gvwr: "gvwr_class",
  gvwrclass: "gvwr_class",
  weightclass: "gvwr_class",
  site: "depot",
  yard: "depot",
  statut: "status",
  status: "status",
  notes: "notes",
};

function normaliserCle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normaliserValeur(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

// synonymes usuels → valeurs canoniques
const SYNONYMES_CATEGORIE: Record<string, string> = {
  vehicule_leger: "vehicule_leger",
  leger: "vehicule_leger",
  berline: "vehicule_leger",
  vus: "vehicule_leger",
  camionnette: "camionnette",
  pickup: "camionnette",
  fourgonnette: "camionnette",
  fourgon: "camionnette",
  camion_moyen: "camion_moyen",
  porteur: "camion_moyen",
  camion_lourd: "camion_lourd",
  lourd: "camion_lourd",
  tracteur: "camion_lourd",
  autobus: "autobus_urbain_12m",
  autobus_urbain: "autobus_urbain_12m",
  autobus_urbain_12m: "autobus_urbain_12m",
  bus: "autobus_urbain_12m",
  // catégories municipales (bloc 2.3), FR et EN
  deneigeuse: "deneigeuse",
  chasse_neige: "deneigeuse",
  camion_de_deneigement: "deneigeuse",
  snowplow: "deneigeuse",
  snow_plow: "deneigeuse",
  plow_truck: "deneigeuse",
  souffleuse: "souffleuse",
  souffleuse_a_neige: "souffleuse",
  snowblower: "souffleuse",
  snow_blower: "souffleuse",
  camion_benne: "camion_benne",
  camion_a_benne: "camion_benne",
  benne: "camion_benne",
  dump_truck: "camion_benne",
  dumptruck: "camion_benne",
  vehicule_specialise: "vehicule_specialise",
  specialise: "vehicule_specialise",
  outil: "vehicule_specialise",
  equipement: "vehicule_specialise",
  balai_mecanique: "vehicule_specialise",
  nacelle: "vehicule_specialise",
  specialty_vehicle: "vehicule_specialise",
  specialized: "vehicule_specialise",
  equipment: "vehicule_specialise",
  sweeper: "vehicule_specialise",
  vehicule_urgence: "vehicule_urgence",
  urgence: "vehicule_urgence",
  incendie: "vehicule_urgence",
  ambulance: "vehicule_urgence",
  police: "vehicule_urgence",
  emergency: "vehicule_urgence",
  emergency_vehicle: "vehicule_urgence",
  fire_truck: "vehicule_urgence",
  light_vehicle: "vehicule_leger",
  car: "vehicule_leger",
  van: "camionnette",
  pickup_truck: "camionnette",
  medium_truck: "camion_moyen",
  heavy_truck: "camion_lourd",
  autre: "autre",
  other: "autre",
};

/** Valeurs acceptées par catégorie (message d'erreur de l'import et modèle). */
export function synonymesParCategorie(): Record<string, string[]> {
  const parCat: Record<string, string[]> = {};
  for (const [syn, cat] of Object.entries(SYNONYMES_CATEGORIE)) (parCat[cat] ??= []).push(syn);
  return parCat;
}

const SYNONYMES_CARBURANT: Record<string, string> = {
  diesel: "diesel",
  essence: "essence",
  gasoline: "essence",
  hybride: "hybride",
  hybrid: "hybride",
  phev: "phev",
  hybride_rechargeable: "phev",
  bev: "bev",
  electrique: "bev",
  electric: "bev",
  fcev: "fcev",
  hydrogene: "fcev",
  hydrogen: "fcev",
  gnc: "gnc",
  cng: "gnc",
  propane: "propane",
  autre: "autre",
};

const SYNONYMES_STATUT: Record<string, string> = {
  actif: "actif",
  active: "actif",
  inactif: "inactif",
  inactive: "inactif",
  reforme: "reforme",
  retired: "reforme",
  vendu: "vendu",
  sold: "vendu",
};

const SYNONYMES_USAGE: Record<string, string> = {
  urbain: "urbain",
  urban: "urbain",
  regional: "regional",
  longue_distance: "longue_distance",
  longhaul: "longue_distance",
  mixte: "mixte",
  mixed: "mixte",
  hors_route: "hors_route",
  offroad: "hors_route",
};

const SYNONYMES_SOURCE: Record<string, string> = {
  saisie: "saisie",
  manuel: "saisie",
  manual: "saisie",
  telematique: "telematique",
  telematics: "telematique",
  estimation: "estimation",
  estimate: "estimation",
};

/**
 * Conversion numérique STRICTE : une valeur illisible n'est JAMAIS
 * avalée — elle devient une erreur explicite. Un suffixe d'unité après
 * le nombre est toléré (« 12 000 km », « 45 L/100km »).
 */
type Nombre = { ok: true; valeur: number | null } | { ok: false; brut: string };

function nombre(v: unknown): Nombre {
  if (v === undefined || v === null || String(v).trim() === "") return { ok: true, valeur: null };
  if (typeof v === "number") {
    return Number.isFinite(v) ? { ok: true, valeur: v } : { ok: false, brut: String(v) };
  }
  const brut = String(v).trim();
  // espaces (y compris insécables) retirés, virgule décimale acceptée
  const s = brut.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  const m = s.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!m) return { ok: false, brut };
  const suffixe = m[2];
  // suffixe vide, ou unité commençant par une lettre/%/$ (« km », « L/100km »)
  if (suffixe !== "" && !/^[a-zA-Z%$]/.test(suffixe)) return { ok: false, brut };
  const n = Number(m[1]);
  return Number.isFinite(n) ? { ok: true, valeur: n } : { ok: false, brut };
}

/**
 * Date de mise en service : « AAAA-MM-JJ » (séparateurs -, / ou .
 * acceptés) ou numéro de série Excel plausible (20000-60000, soit
 * ~1954-2064, base 1899-12-30). Tout le reste = erreur explicite.
 */
function dateISO(v: unknown): { ok: true; valeur: string | null } | { ok: false; brut: string } {
  if (v === undefined || v === null || String(v).trim() === "") return { ok: true, valeur: null };
  const brut = String(v).trim();
  const serie = /^\d{5}(\.0+)?$/.test(brut) ? Number(brut) : NaN;
  if (serie >= 20000 && serie <= 60000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serie) * 86_400_000);
    return { ok: true, valeur: d.toISOString().slice(0, 10) };
  }
  const m = brut.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const [, a, mo, j] = m;
    return { ok: true, valeur: `${a}-${mo.padStart(2, "0")}-${j.padStart(2, "0")}` };
  }
  return { ok: false, brut };
}

// Les enums de choix sont vérifiées AVANT zod (message français + valeur
// citée) ; ici elles restent optionnelles pour permettre la mise à jour
// partielle d'une unité existante.
const zLigne = z.object({
  unit_number: z.string().trim().min(1, "numéro d'unité manquant"),
  vin: z.string().trim().max(30, "NIV trop long (30 caractères max)").nullish(),
  make: z.string().trim().nullish(),
  model: z.string().trim().nullish(),
  model_year: z
    .number({ invalid_type_error: "année modèle : nombre attendu" })
    .int("année modèle : nombre entier attendu")
    .min(1950, "année modèle hors plage (1950-2100)")
    .max(2100, "année modèle hors plage (1950-2100)")
    .nullish(),
  in_service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format attendu AAAA-MM-JJ").nullish(),
  category: z.enum(CATEGORIES_VEHICULE).nullish(),
  fuel_type: z.enum(CARBURANTS).nullish(),
  annual_km: z
    .number({ invalid_type_error: "kilométrage annuel : nombre attendu" })
    .min(0, "kilométrage annuel négatif")
    .max(1_000_000, "kilométrage annuel hors plage (max 1 000 000)")
    .nullish(),
  consumption_per_100km: z
    .number({ invalid_type_error: "consommation : nombre attendu" })
    .positive("consommation : valeur positive attendue")
    .max(1000, "consommation hors plage (max 1000)")
    .nullish(),
  consumption_source: z.enum(SOURCES_CONSOMMATION).nullish(),
  usage_profile: z.enum(PROFILS_USAGE).nullish(),
  department: z.string().trim().nullish(),
  depot: z.string().trim().nullish(),
  gvwr_class: z.enum(CLASSES_PNBV).nullish(),
  max_daily_km: z
    .number({ invalid_type_error: "km journalier max : nombre attendu" })
    .min(0, "km journalier max négatif")
    .max(5000, "km journalier max hors plage (max 5000)")
    .nullish(),
  status: z.enum(STATUTS_VEHICULE).nullish(),
  notes: z.string().trim().max(2000, "notes trop longues (2000 caractères max)").nullish(),
});

export interface ErreurImport {
  ligne: number; // numéro de ligne de données (1 = première ligne sous l'entête)
  champ: string;
  message: string;
}

/** Mise à jour proposée pour une unité déjà présente dans la flotte. */
export interface MiseAJourImport {
  id: string;
  unit_number: string;
  patch: Partial<VehicleInsert>;
}

export interface ResultatImport {
  valides: VehicleInsert[];
  misesAJour: MiseAJourImport[];
  erreurs: ErreurImport[];
}

const fourni = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== "";

/** Valeurs canoniques acceptées par champ à choix fermé, avec leurs
 *  synonymes (modèle d'import « Lisez-moi », messages d'erreur). */
export function valeursAcceptees(): Record<
  "category" | "fuel_type" | "usage_profile" | "status" | "consumption_source",
  Record<string, string[]>
> {
  const grouper = (table: Record<string, string>) => {
    const r: Record<string, string[]> = {};
    for (const [syn, canon] of Object.entries(table)) (r[canon] ??= []).push(syn);
    return r;
  };
  return {
    category: grouper(SYNONYMES_CATEGORIE),
    fuel_type: grouper(SYNONYMES_CARBURANT),
    usage_profile: grouper(SYNONYMES_USAGE),
    status: grouper(SYNONYMES_STATUT),
    consumption_source: grouper(SYNONYMES_SOURCE),
  };
}

/**
 * Normalise et valide des lignes déjà lues (entête → valeur). PURE.
 * - Toute valeur illisible = ERREUR explicite (jamais de valeur inventée).
 * - Carburant et catégorie OBLIGATOIRES pour un nouveau véhicule (aucun
 *   défaut « diesel »).
 * - Un numéro d'unité déjà présent dans `unitesExistantes` devient une
 *   PROPOSITION de mise à jour (patch = champs fournis seulement),
 *   jamais un échec du lot.
 */
export function validerLignes(
  lignes: Array<Record<string, unknown>>,
  organizationId: string,
  unitesExistantes?: Map<string, string>,
): ResultatImport {
  const valides: VehicleInsert[] = [];
  const misesAJour: MiseAJourImport[] = [];
  const erreurs: ErreurImport[] = [];
  const unitesVues = new Set<string>();

  lignes.forEach((brute, index) => {
    const ligne = index + 1;
    // 1. renommage des entêtes
    const champs: Record<string, unknown> = {};
    for (const [cle, valeur] of Object.entries(brute)) {
      const champ = ENTETES[normaliserCle(cle)];
      if (champ) champs[champ] = valeur;
    }
    if (Object.values(champs).every((v) => !fourni(v))) return; // ligne vide/ignorée

    const erreursLigne: ErreurImport[] = [];
    const unitNumber = String(champs.unit_number ?? "").trim();
    if (!unitNumber) {
      erreurs.push({ ligne, champ: "unit_number", message: "numéro d'unité manquant" });
      return;
    }
    const idExistant = unitesExistantes?.get(unitNumber);

    // 2. choix fermés : valeur fournie inconnue = erreur qui cite la valeur
    const choix = (
      champ: string,
      table: Record<string, string>,
      libelle: string,
    ): string | undefined => {
      if (!fourni(champs[champ])) return undefined;
      const v = table[normaliserValeur(String(champs[champ]))];
      if (!v) {
        erreursLigne.push({
          ligne,
          champ: libelle,
          message: `${libelle} non reconnu(e) : « ${String(champs[champ]).trim()} »`,
        });
      }
      return v;
    };
    const cat = choix("category", SYNONYMES_CATEGORIE, "catégorie");
    if (fourni(champs.category) && !cat) {
      // message enrichi : la liste des catégories acceptées et leurs synonymes FR/EN
      const derniere = erreursLigne[erreursLigne.length - 1];
      derniere.message +=
        " — catégories acceptées : " +
        Object.entries(synonymesParCategorie())
          .map(([c, syns]) => `${c} (${syns.filter((s) => s !== c).join(", ") || "—"})`)
          .join(" ; ");
    }
    const fuel = choix("fuel_type", SYNONYMES_CARBURANT, "carburant");
    const statut = choix("status", SYNONYMES_STATUT, "statut");
    const usage = choix("usage_profile", SYNONYMES_USAGE, "usage");
    const sourceFournie = choix("consumption_source", SYNONYMES_SOURCE, "source de consommation");

    // champs OBLIGATOIRES pour un NOUVEAU véhicule — aucun défaut inventé
    if (!idExistant && !fourni(champs.category)) {
      erreursLigne.push({ ligne, champ: "catégorie", message: "catégorie manquante" });
    }
    if (!idExistant && !fourni(champs.fuel_type)) {
      erreursLigne.push({
        ligne,
        champ: "carburant",
        message: "carburant manquant (aucune valeur par défaut n'est appliquée)",
      });
    }

    // 3. nombres : illisible = erreur, jamais ignoré
    const num = (champ: string, libelle: string): number | null | undefined => {
      const r = nombre(champs[champ]);
      if (r.ok === false) {
        erreursLigne.push({
          ligne,
          champ: libelle,
          message: `valeur illisible pour ${libelle} : « ${r.brut} » (nombre attendu)`,
        });
        return undefined;
      }
      return r.valeur;
    };
    const anneeModele = num("model_year", "année modèle");
    const kmAnnuel = num("annual_km", "kilométrage annuel");
    const conso = num("consumption_per_100km", "consommation");
    const kmJourMax = num("max_daily_km", "km journalier max");

    const classePnbv = fourni(champs.gvwr_class) ? lireClassePnbv(champs.gvwr_class) : null;
    if (fourni(champs.gvwr_class) && !classePnbv) {
      erreursLigne.push({
        ligne,
        champ: "classe PNBV",
        message: `classe de poids PNBV illisible : « ${String(champs.gvwr_class).trim()} » (valeurs acceptées : ${CLASSES_PNBV.join(", ")}, ou le PNBV en kg / lb)`,
      });
    }

    const dt = dateISO(champs.in_service_date);
    if (dt.ok === false) {
      erreursLigne.push({
        ligne,
        champ: "mise en service",
        message: `date illisible : « ${dt.brut} » (format AAAA-MM-JJ ou date Excel attendus)`,
      });
    }

    if (erreursLigne.length > 0) {
      erreurs.push(...erreursLigne);
      return;
    }

    // la source suit la réalité : consommation fournie → « saisie » par
    // défaut ; absente (nouveau véhicule) → « estimation » (défaut de
    // catégorie du moteur)
    const source = sourceFournie ?? (conso != null ? "saisie" : idExistant ? undefined : "estimation");

    const candidat = {
      unit_number: unitNumber,
      vin: fourni(champs.vin) ? String(champs.vin).trim() : null,
      make: fourni(champs.make) ? String(champs.make).trim() : null,
      model: fourni(champs.model) ? String(champs.model).trim() : null,
      model_year: anneeModele,
      in_service_date: dt.ok ? dt.valeur : null,
      category: cat as (typeof CATEGORIES_VEHICULE)[number] | undefined,
      fuel_type: fuel as (typeof CARBURANTS)[number] | undefined,
      annual_km: kmAnnuel,
      consumption_per_100km: conso,
      consumption_source: source as (typeof SOURCES_CONSOMMATION)[number] | undefined,
      usage_profile: (usage ?? null) as (typeof PROFILS_USAGE)[number] | null,
      department: fourni(champs.department) ? String(champs.department).trim() : null,
      depot: fourni(champs.depot) ? String(champs.depot).trim() : null,
      gvwr_class: classePnbv,
      max_daily_km: kmJourMax,
      status: (statut ?? (idExistant ? undefined : "actif")) as (typeof STATUTS_VEHICULE)[number] | undefined,
      notes: fourni(champs.notes) ? String(champs.notes).trim() : null,
    };

    // 4. validation zod (messages français)
    const resultat = zLigne.safeParse(candidat);
    if (!resultat.success) {
      for (const e of resultat.error.errors) {
        erreurs.push({ ligne, champ: e.path.join(".") || "ligne", message: e.message });
      }
      return;
    }
    if (unitesVues.has(unitNumber)) {
      erreurs.push({
        ligne,
        champ: "unit_number",
        message: `numéro d'unité en double dans le fichier : ${unitNumber}`,
      });
      return;
    }
    unitesVues.add(unitNumber);

    if (idExistant) {
      // patch = seulement les champs réellement fournis dans le fichier
      // (une colonne vide n'efface JAMAIS une donnée existante)
      const patch: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(resultat.data)) {
        if (k === "unit_number") continue;
        if (fourni(champs[k])) patch[k] = val;
      }
      if (conso != null && !fourni(champs.consumption_source)) patch.consumption_source = "saisie";
      misesAJour.push({ id: idExistant, unit_number: unitNumber, patch: patch as Partial<VehicleInsert> });
    } else {
      valides.push({ ...resultat.data, organization_id: organizationId } as VehicleInsert);
    }
  });

  return { valides, misesAJour, erreurs };
}

/** Valeur brute d'une cellule exceljs : texte riche, formule, lien et
 *  date sont ramenés à une valeur simple ; une DATE Excel devient
 *  « AAAA-MM-JJ » (jamais un numéro de série). */
function valeurCellule(v: unknown): unknown {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: unknown; result?: unknown; hyperlink?: unknown };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (o.result !== undefined) return valeurCellule(o.result);
    if (o.text !== undefined) return valeurCellule(o.text);
    return "";
  }
  return v;
}

/** Lit un fichier CSV (papaparse) ou Excel .xlsx (exceljs — SheetJS
 *  0.18.5 est retiré : CVE-2023-30533 / CVE-2024-22363). Le vieux
 *  format .xls n'est plus accepté : exporter en .xlsx ou CSV. */
export async function lireFichier(file: File): Promise<Array<Record<string, unknown>>> {
  const nom = file.name.toLowerCase();
  if (nom.endsWith(".csv") || nom.endsWith(".txt")) {
    const texte = await file.text();
    const resultat = Papa.parse<Record<string, unknown>>(texte, {
      header: true,
      skipEmptyLines: true,
    });
    return resultat.data;
  }
  if (nom.endsWith(".xlsx")) {
    const ExcelJS = await import("exceljs");
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(await file.arrayBuffer());
    const feuille = classeur.worksheets[0];
    if (!feuille) return [];
    const entetes: string[] = [];
    feuille.getRow(1).eachCell({ includeEmpty: true }, (cellule, col) => {
      entetes[col] = String(valeurCellule(cellule.value)).trim();
    });
    const lignes: Array<Record<string, unknown>> = [];
    for (let r = 2; r <= feuille.rowCount; r++) {
      const rangee = feuille.getRow(r);
      const objet: Record<string, unknown> = {};
      let vide = true;
      rangee.eachCell({ includeEmpty: true }, (cellule, col) => {
        const cle = entetes[col];
        if (!cle) return;
        const valeur = valeurCellule(cellule.value);
        objet[cle] = valeur;
        if (valeur !== "" && valeur !== null) vide = false;
      });
      // les colonnes sans cellule restent définies (comme defval: "")
      for (const cle of entetes) {
        if (cle && !(cle in objet)) objet[cle] = "";
      }
      if (!vide) lignes.push(objet);
    }
    return lignes;
  }
  if (nom.endsWith(".xls")) {
    throw new Error("le format .xls (Excel 97-2003) n'est plus pris en charge : enregistrer en .xlsx ou en CSV");
  }
  throw new Error("format non pris en charge (CSV ou XLSX attendu)");
}
