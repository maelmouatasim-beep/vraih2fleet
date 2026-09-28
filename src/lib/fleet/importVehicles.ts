/**
 * Import de flotte depuis CSV/Excel — validation ligne par ligne.
 * Fonctions PURES (testées) : le fichier est d'abord transformé en
 * lignes {entête → valeur}, puis chaque ligne est normalisée et validée
 * (zod). Aucune ligne invalide n'est importée ; chaque erreur cite la
 * ligne, le champ et la raison.
 */
import { z } from "zod";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  CARBURANTS,
  CATEGORIES_VEHICULE,
  PROFILS_USAGE,
  SOURCES_CONSOMMATION,
  STATUTS_VEHICULE,
  type VehicleInsert,
} from "./vehicles";

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
  autre: "autre",
};

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

function nombre(v: unknown): number | null | undefined {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const zLigne = z.object({
  unit_number: z.string().trim().min(1),
  vin: z.string().trim().max(30).nullish(),
  make: z.string().trim().nullish(),
  model: z.string().trim().nullish(),
  model_year: z.number().int().min(1950).max(2100).nullish(),
  in_service_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "format attendu AAAA-MM-JJ")
    .nullish(),
  category: z.enum(CATEGORIES_VEHICULE),
  fuel_type: z.enum(CARBURANTS),
  annual_km: z.number().min(0).max(1_000_000).nullish(),
  consumption_per_100km: z.number().positive().max(1000).nullish(),
  consumption_source: z.enum(SOURCES_CONSOMMATION),
  usage_profile: z.enum(PROFILS_USAGE).nullish(),
  department: z.string().trim().nullish(),
  depot: z.string().trim().nullish(),
  status: z.enum(STATUTS_VEHICULE),
  notes: z.string().trim().max(2000).nullish(),
});

export interface ErreurImport {
  ligne: number; // numéro de ligne de données (1 = première ligne sous l'entête)
  champ: string;
  message: string;
}

export interface ResultatImport {
  valides: VehicleInsert[];
  erreurs: ErreurImport[];
}

/** Normalise et valide des lignes déjà lues (entête → valeur). PURE. */
export function validerLignes(
  lignes: Array<Record<string, unknown>>,
  organizationId: string,
): ResultatImport {
  const valides: VehicleInsert[] = [];
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
    if (Object.keys(champs).length === 0) return; // ligne vide/ignorée

    // 2. normalisation des valeurs
    const cat = champs.category !== undefined && champs.category !== null && champs.category !== ""
      ? SYNONYMES_CATEGORIE[normaliserValeur(String(champs.category))]
      : undefined;
    const fuel = champs.fuel_type !== undefined && champs.fuel_type !== null && champs.fuel_type !== ""
      ? SYNONYMES_CARBURANT[normaliserValeur(String(champs.fuel_type))]
      : "diesel";
    const statut = champs.status !== undefined && champs.status !== null && champs.status !== ""
      ? SYNONYMES_STATUT[normaliserValeur(String(champs.status))]
      : "actif";
    const usage = champs.usage_profile !== undefined && champs.usage_profile !== null && champs.usage_profile !== ""
      ? SYNONYMES_USAGE[normaliserValeur(String(champs.usage_profile))]
      : null;
    const conso = nombre(champs.consumption_per_100km);
    // la source suit la réalité : consommation fournie → « saisie » par
    // défaut ; absente → « estimation » (défaut de catégorie du moteur)
    const source = champs.consumption_source !== undefined && champs.consumption_source !== null && champs.consumption_source !== ""
      ? SYNONYMES_SOURCE[normaliserValeur(String(champs.consumption_source))]
      : conso != null
        ? "saisie"
        : "estimation";

    const candidat = {
      unit_number: String(champs.unit_number ?? "").trim(),
      vin: champs.vin ? String(champs.vin) : null,
      make: champs.make ? String(champs.make) : null,
      model: champs.model ? String(champs.model) : null,
      model_year: nombre(champs.model_year),
      in_service_date: champs.in_service_date ? String(champs.in_service_date).slice(0, 10) : null,
      category: cat as (typeof CATEGORIES_VEHICULE)[number],
      fuel_type: fuel as (typeof CARBURANTS)[number],
      annual_km: nombre(champs.annual_km),
      consumption_per_100km: conso,
      consumption_source: source as (typeof SOURCES_CONSOMMATION)[number],
      usage_profile: usage as (typeof PROFILS_USAGE)[number] | null,
      department: champs.department ? String(champs.department) : null,
      depot: champs.depot ? String(champs.depot) : null,
      status: statut as (typeof STATUTS_VEHICULE)[number],
      notes: champs.notes ? String(champs.notes) : null,
    };

    if (champs.category && !cat) {
      erreurs.push({ ligne, champ: "categorie", message: `catégorie inconnue : « ${String(champs.category)} »` });
      return;
    }
    if (champs.fuel_type && !fuel) {
      erreurs.push({ ligne, champ: "carburant", message: `carburant inconnu : « ${String(champs.fuel_type)} »` });
      return;
    }

    // 3. validation
    const resultat = zLigne.safeParse(candidat);
    if (!resultat.success) {
      for (const e of resultat.error.errors) {
        erreurs.push({ ligne, champ: e.path.join(".") || "ligne", message: e.message });
      }
      return;
    }
    if (unitesVues.has(resultat.data.unit_number)) {
      erreurs.push({ ligne, champ: "unit_number", message: `numéro d'unité en double dans le fichier : ${resultat.data.unit_number}` });
      return;
    }
    unitesVues.add(resultat.data.unit_number);
    valides.push({ ...resultat.data, organization_id: organizationId } as VehicleInsert);
  });

  return { valides, erreurs };
}

/** Lit un fichier CSV (papaparse) ou Excel (SheetJS) en lignes brutes. */
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
  if (nom.endsWith(".xlsx") || nom.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const classeur = XLSX.read(buffer, { type: "array" });
    const feuille = classeur.Sheets[classeur.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(feuille, { raw: true, defval: "" });
  }
  throw new Error("format non pris en charge (CSV, XLSX ou XLS attendu)");
}
