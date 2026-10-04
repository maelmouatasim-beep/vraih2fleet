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
  no: "unit_number",
  numero: "unit_number",
  nounite: "unit_number",
  numerovehicule: "unit_number",
  vin: "vin",
  niv: "vin",
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
  type: "category",
  typedevehicule: "category",
  typevehicule: "category",
  genre: "category",
  vehicletype: "category",
  carburant: "fuel_type",
  fuel: "fuel_type",
  fueltype: "fuel_type",
  kman: "annual_km",
  kmparan: "annual_km",
  kmannuel: "annual_km",
  kilometrageannuel: "annual_km",
  annualkm: "annual_km",
  consommation: "consumption_per_100km",
  conso: "consumption_per_100km",
  consol100: "consumption_per_100km",
  consol100km: "consumption_per_100km",
  consommationl100: "consumption_per_100km",
  consommationl100km: "consumption_per_100km",
  l100km: "consumption_per_100km",
  consumption: "consumption_per_100km",
  consumptionper100km: "consumption_per_100km",
  sourceconsommation: "consumption_source",
  consumptionsource: "consumption_source",
  usage: "usage_profile",
  trajet: "usage_profile",
  usageprofile: "usage_profile",
  departement: "department",
  department: "department",
  service: "department",
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

/** Entêtes « kilométrage d'une année » (« Km 2025 », « Kilométrage 2024 »). */
const ENTETES_KM_ANNEE = new Set(["km", "kms", "kilometrage", "kmparcourus"]);

/** Entêtes de texte libre qui portent souvent la catégorie (« Description ») :
 *  utilisées comme catégorie SEULEMENT quand aucune colonne catégorie n'existe. */
const ENTETES_CATEGORIE_SECONDAIRES = new Set(["description", "desc", "designation", "libelle"]);
export function estEnteteCategorieSecondaire(entete: string): boolean {
  return ENTETES_CATEGORIE_SECONDAIRES.has(normaliserCle(entete));
}

/** Champ du modèle d'import reconnu pour une entête (synonymes FR/EN), ou null. */
export function champPourEntete(entete: string): string | null {
  const cle = normaliserCle(entete);
  const direct = ENTETES[cle];
  if (direct) return direct;
  // « Km 2025 » = kilométrage parcouru dans l'année = km annuel (jamais
  // l'odomètre, qui n'a pas d'année dans son entête).
  const sansAnnee = cle.replace(/(19|20)\d{2}/, "");
  if (sansAnnee !== cle && ENTETES_KM_ANNEE.has(sansAnnee)) return "annual_km";
  return null;
}

/** Libellé français d'un champ (messages d'erreur : jamais le nom technique). */
export const LIBELLES_CHAMPS: Record<string, string> = {
  unit_number: "unité",
  vin: "NIV",
  make: "marque",
  model: "modèle",
  model_year: "année modèle",
  in_service_date: "mise en service",
  category: "catégorie",
  fuel_type: "carburant",
  annual_km: "kilométrage annuel",
  consumption_per_100km: "consommation",
  consumption_source: "source de consommation",
  usage_profile: "usage",
  department: "service",
  depot: "garage",
  gvwr_class: "classe PNBV",
  max_daily_km: "km journalier max",
  status: "statut",
  notes: "notes",
};

// ---------------------------------------------------------------------------
// Lecture d'une grille brute : ligne d'entête, lignes de total
// ---------------------------------------------------------------------------

const estNombreCellule = (s: string) => /^-?[\d\s\u00a0\u202f.,]+$/.test(s.trim()) && /\d/.test(s);

/**
 * Ligne d'entête parmi les 15 premières. Score = cellules texte DISTINCTES
 * (une cellule fusionnée répète sa valeur sur toutes ses colonnes : un
 * titre fusionné ne compte qu'une fois) + 3 par entête reconnue par les
 * synonymes ; au moins 2 cellules distinctes ; à égalité, la première.
 */
export function detecterEntete(grille: string[][]): number {
  let meilleure = 0;
  let score = -1;
  grille.slice(0, 15).forEach((ligne, i) => {
    const textes = new Set(ligne.map((c) => (c ?? "").trim()).filter((c) => c !== "" && !estNombreCellule(c)));
    if (textes.size < 2) return;
    const connues = [...textes].filter((c) => champPourEntete(c) !== null).length;
    const s = textes.size + 3 * connues;
    if (s > score) {
      score = s;
      meilleure = i;
    }
  });
  return meilleure;
}

/** Ligne de total ou de sous-total (« Sous-total Travaux publics », « TOTAL ») : jamais un véhicule. */
export function estLigneTotal(ligne: string[]): boolean {
  const premiere = ligne.map((c) => (c ?? "").trim()).find((c) => c !== "");
  return premiere !== undefined && /^(sous[-\s]?)?total\b/i.test(premiere);
}

export interface DiagnosticEntete {
  /** Numéro de la ligne d'entête dans le fichier (1 = première ligne). */
  ligneEntete: number;
  reconnues: string[];
  ignorees: string[];
  /** Aucune colonne reconnue comme numéro d'unité. */
  sansUnite: boolean;
  lignesTotal: number;
}

/** Grille → lignes {entête → valeur} sous l'entête détectée, totaux retirés. */
export function lignesDepuisGrille(grille: string[][]): { lignes: Array<Record<string, unknown>>; diagnostic: DiagnosticEntete } {
  const i = detecterEntete(grille);
  const entetes = (grille[i] ?? []).map((c) => (c ?? "").trim());
  const lignes: Array<Record<string, unknown>> = [];
  let lignesTotal = 0;
  for (const ligne of grille.slice(i + 1)) {
    if (ligne.every((c) => (c ?? "").trim() === "")) continue;
    if (estLigneTotal(ligne)) {
      lignesTotal++;
      continue;
    }
    const objet: Record<string, unknown> = {};
    entetes.forEach((e, j) => {
      if (e && !(e in objet)) objet[e] = (ligne[j] ?? "").trim();
    });
    lignes.push(objet);
  }
  const nonVides = [...new Set(entetes.filter(Boolean))];
  const avecCategorie = nonVides.some((e) => champPourEntete(e) === "category");
  const reconnue = (e: string) => champPourEntete(e) !== null || (!avecCategorie && estEnteteCategorieSecondaire(e));
  const reconnues = nonVides.filter(reconnue);
  return {
    lignes,
    diagnostic: {
      ligneEntete: i + 1,
      reconnues,
      ignorees: nonVides.filter((e) => !reconnue(e)),
      sansUnite: !reconnues.some((e) => champPourEntete(e) === "unit_number"),
      lignesTotal,
    },
  };
}

/** Une valeur de choix fermé est-elle reconnue par les synonymes ? */
/**
 * Catégorie déduite d'un libellé usuel de parc municipal (« Auto compacte »,
 * « Pick-up 1/2 tonne », « Camion 10 roues », « Chasse-neige »…) quand il
 * n'est pas un synonyme exact. Seulement les libellés SANS ambiguïté :
 * « Minibus adapté » ou « Camion » seul restent non reconnus (à choisir).
 */
export function categorieDepuisLibelle(brut: string): string | null {
  const t = ` ${brut.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9/]+/g, " ").trim()} `;
  const regles: [RegExp, string][] = [
    [/ (chasse neige|deneigeuse|charrue|epandeuse) /, "deneigeuse"],
    [/ souffleuse /, "souffleuse"],
    [/ (autopompe|pompe|echelle|camion incendie|ambulance|police|patrouille|urgence) /, "vehicule_urgence"],
    [/ (balai|balayeuse|nacelle|tracteur a trottoir|chargeuse|retrocaveuse|niveleuse|tondeuse|chariot) /, "vehicule_specialise"],
    [/ (camion a benne|benne) /, "camion_benne"],
    [/ (10|dix|12|douze) roues /, "camion_lourd"],
    [/ (6|six) roues /, "camion_moyen"],
    [/ (pick ?up|camionnette|fourgon|fourgonnette|minifourgonnette|cube) /, "camionnette"],
    [/ (auto|automobile|voiture|berline|compacte|sous compacte|vus|suv|multisegment|vehicule leger) /, "vehicule_leger"],
  ];
  for (const [re, cat] of regles) if (re.test(t)) return cat;
  return null;
}

export function valeurReconnue(champ: "category" | "fuel_type" | "usage_profile" | "status", brut: string): string | null {
  if (champ === "category") return SYNONYMES_CATEGORIE[normaliserValeur(brut)] ?? categorieDepuisLibelle(brut);
  const table = champ === "fuel_type" ? SYNONYMES_CARBURANT : champ === "usage_profile" ? SYNONYMES_USAGE : SYNONYMES_STATUT;
  return table[normaliserValeur(brut)] ?? null;
}

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
    .replace(/\.+$/, "")
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

/** Libellés français des catégories (messages d'erreur : jamais un code). */
const LIBELLES_CATEGORIES: Record<string, string> = {
  vehicule_leger: "véhicule léger",
  camionnette: "camionnette / fourgonnette",
  camion_moyen: "camion moyen (classes 4-6)",
  camion_lourd: "camion lourd (classes 7-8)",
  autobus_urbain_12m: "autobus urbain 12 m",
  deneigeuse: "déneigeuse",
  souffleuse: "souffleuse à neige",
  camion_benne: "camion à benne",
  vehicule_specialise: "véhicule spécialisé / outil",
  vehicule_urgence: "véhicule d'urgence",
  autre: "autre",
};

/** Valeurs acceptées par catégorie (message d'erreur de l'import et modèle). */
export function synonymesParCategorie(): Record<string, string[]> {
  const parCat: Record<string, string[]> = {};
  for (const [syn, cat] of Object.entries(SYNONYMES_CATEGORIE)) (parCat[cat] ??= []).push(syn);
  return parCat;
}

const SYNONYMES_CARBURANT: Record<string, string> = {
  diesel: "diesel",
  diesel_b5: "diesel",
  diesel_b20: "diesel",
  biodiesel: "diesel",
  ess: "essence",
  gaz: "essence", // « gaz » = essence au Québec (le gaz naturel est « gaz naturel » / GNC)
  gas: "essence",
  gaz_naturel: "gnc",
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
  import: "import",
  importe: "import",
  imported: "import",
  fichier: "import",
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

const UNITES_CANONIQUES = /^(km|kms|km\/an|km\/j|l\/100km|l|kw|kwh|kwh\/100km|kg|%|\$)$/i;

/** Valeur explicitement « non disponible » : champ vide, jamais une erreur ni un zéro. */
const NON_DISPONIBLE = /^(n\/?d|n\.d\.?|n\/?a|nc|inconnu|unknown|-+|—|–|\?)$/i;

function nombre(v: unknown, entier = false): Nombre {
  if (v === undefined || v === null || String(v).trim() === "") return { ok: true, valeur: null };
  if (typeof v === "number") {
    return Number.isFinite(v) ? { ok: true, valeur: v } : { ok: false, brut: String(v) };
  }
  const brut = String(v).trim();
  if (NON_DISPONIBLE.test(brut)) return { ok: true, valeur: null };
  let compact = brut.replace(/[\s\u00a0\u202f]/g, "");
  // Champ ENTIER (km, année) : « 12,500 » ou « 12.500 » = séparateur de
  // milliers (12 500), jamais 12,5 km lu en silence.
  // « 2015? » (valeur douteuse notée dans le fichier) : la valeur écrite est lue.
  if (entier) compact = compact.replace(/^(\d+)\?$/, "$1");
  if (entier) compact = compact.replace(/^(\d{1,3})((?:[.,]\d{3})+)(?=[^\d.,]|$)/, (_, a: string, b: string) => a + b.replace(/[.,]/g, ""));
  // virgule décimale acceptée
  const s = compact.replace(",", ".");
  const m = s.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!m) return { ok: false, brut };
  const suffixe = m[2];
  // suffixe vide, ou unité CANONIQUE du modèle (« km », « L/100km »…) :
  // « mi », « mpg » ou un texte (« 15000 Garage central ») = erreur, jamais
  // lu comme des km (conversions : import intelligent).
  if (suffixe !== "" && !UNITES_CANONIQUES.test(suffixe)) return { ok: false, brut };
  const n = Number(m[1]);
  return Number.isFinite(n) ? { ok: true, valeur: n } : { ok: false, brut };
}

const MOIS: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1, january: 1,
  fevrier: 2, fevr: 2, fev: 2, february: 2, feb: 2,
  mars: 3, mar: 3, march: 3,
  avril: 4, avr: 4, april: 4, apr: 4,
  mai: 5, may: 5,
  juin: 6, june: 6, jun: 6,
  juillet: 7, juil: 7, july: 7, jul: 7,
  aout: 8, august: 8, aug: 8,
  septembre: 9, sept: 9, sep: 9, september: 9,
  octobre: 10, oct: 10, october: 10,
  novembre: 11, nov: 11, november: 11,
  decembre: 12, dec: 12, december: 12,
};

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
  // « mai 2016 », « sept. 2018 », « May 2016 » : premier jour du mois.
  const mm = brut
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/^([a-z]+)\.?\s+(\d{4})$/);
  if (mm) {
    const mois = MOIS[mm[1]];
    if (mois) return { ok: true, valeur: `${mm[2]}-${String(mois).padStart(2, "0")}-01` };
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
      const champ = champPourEntete(cle);
      if (champ && !fourni(champs[champ])) champs[champ] = valeur;
    }
    // Pas de colonne catégorie : « Description » en tient lieu (audit, point 2).
    if (!Object.keys(brute).some((cle) => champPourEntete(cle) === "category")) {
      const cleDesc = Object.keys(brute).find(estEnteteCategorieSecondaire);
      if (cleDesc && fourni(brute[cleDesc])) champs.category = brute[cleDesc];
    }
    if (Object.values(champs).every((v) => !fourni(v))) return; // ligne vide/ignorée

    const erreursLigne: ErreurImport[] = [];
    const unitNumber = String(champs.unit_number ?? "").trim();
    if (!unitNumber) {
      erreurs.push({ ligne, champ: LIBELLES_CHAMPS.unit_number, message: "numéro d'unité manquant" });
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
      const v =
        table[normaliserValeur(String(champs[champ]))] ??
        (champ === "category" ? categorieDepuisLibelle(String(champs[champ])) ?? undefined : undefined);
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
      derniere.message =
        `catégorie non reconnue : « ${String(champs.category).trim()} » — choisissez l'une des catégories du modèle d'import : ` +
        Object.values(LIBELLES_CATEGORIES).join(", ") +
        ".";
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
    const num = (champ: string, libelle: string, entier = false): number | null | undefined => {
      const r = nombre(champs[champ], entier);
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
    const anneeModele = num("model_year", "année modèle", true);
    const kmAnnuel = num("annual_km", "kilométrage annuel", true);
    const conso = num("consumption_per_100km", "consommation");
    const kmJourMax = num("max_daily_km", "km journalier max", true);

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
    const source = sourceFournie ?? (conso != null ? "import" : idExistant ? undefined : "estimation");

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
        const cle = e.path.join(".");
        erreurs.push({ ligne, champ: LIBELLES_CHAMPS[cle] ?? (cle || "ligne"), message: e.message });
      }
      return;
    }
    if (unitesVues.has(unitNumber)) {
      erreurs.push({
        ligne,
        champ: LIBELLES_CHAMPS.unit_number,
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
      if (conso != null && !fourni(champs.consumption_source)) patch.consumption_source = "import";
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
 *  0.18.5 est retiré : CVE-2023-30533 / CVE-2024-22363) en grille brute,
 *  puis détecte la ligne d'entête (titre, lignes vides ou cellules
 *  fusionnées au-dessus) et retire les lignes de total. Le vieux format
 *  .xls n'est plus accepté : exporter en .xlsx ou CSV. */
export async function lireFichier(file: File): Promise<{ lignes: Array<Record<string, unknown>>; diagnostic: DiagnosticEntete }> {
  const nom = file.name.toLowerCase();
  if (nom.endsWith(".csv") || nom.endsWith(".txt")) {
    const r = Papa.parse<string[]>(await file.text(), { header: false, skipEmptyLines: true });
    return lignesDepuisGrille(r.data.map((l) => l.map((c) => String(c ?? ""))));
  }
  if (nom.endsWith(".xlsx")) {
    const ExcelJS = await import("exceljs");
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(await file.arrayBuffer());
    const feuille = classeur.worksheets[0];
    if (!feuille) return lignesDepuisGrille([]);
    const grille: string[][] = [];
    feuille.eachRow({ includeEmpty: false }, (rangee) => {
      const ligne: string[] = [];
      rangee.eachCell({ includeEmpty: true }, (cellule, col) => {
        const v = valeurCellule(cellule.value);
        ligne[col - 1] = v === null || v === undefined ? "" : String(v);
      });
      grille.push(Array.from(ligne, (c) => c ?? ""));
    });
    return lignesDepuisGrille(grille);
  }
  if (nom.endsWith(".xls")) {
    throw new Error("le format .xls (Excel 97-2003) n'est plus pris en charge : enregistrer en .xlsx ou en CSV");
  }
  throw new Error("format non pris en charge (CSV ou XLSX attendu)");
}
