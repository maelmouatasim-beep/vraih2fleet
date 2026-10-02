/**
 * Modèle d'import de flotte téléchargeable (test terrain, bloc 2.5) —
 * PUR : colonnes, exemples (trois véhicules d'une petite ville sur deux
 * garages) et feuille « Lisez-moi » (obligatoire, description, valeurs
 * acceptées). Les entêtes sont exactement celles que l'import reconnaît :
 * le modèle rempli tel quel s'importe sans erreur (testé).
 */
import Papa from "papaparse";
import { CLASSES_PNBV } from "./gvwr";
import { valeursAcceptees } from "./importVehicles";

type Langue = "fr" | "en";
type Cellule = string | number | null;

interface Colonne {
  champ: string;
  entete: Record<Langue, string>;
  obligatoire: boolean;
  description: Record<Langue, string>;
  /** Valeurs acceptées (champ à choix) — sinon texte libre/nombre. */
  choix?: "category" | "fuel_type" | "usage_profile" | "status" | "gvwr_class";
  exemples: [Cellule, Cellule, Cellule];
}

const COLONNES: Colonne[] = [
  { champ: "unit_number", entete: { fr: "Unité", en: "Unit" }, obligatoire: true,
    description: { fr: "Numéro d'unité unique dans la flotte (un numéro déjà présent met à jour le véhicule).", en: "Unique unit number in the fleet (an existing number updates that vehicle)." },
    exemples: ["HV-01", "TP-12", "TP-20"] },
  { champ: "category", entete: { fr: "Catégorie", en: "Category" }, obligatoire: true, choix: "category",
    description: { fr: "Catégorie du véhicule (synonymes acceptés, voir ci-contre).", en: "Vehicle category (synonyms accepted, see list)." },
    exemples: ["vehicule_leger", "camionnette", "deneigeuse"] },
  { champ: "fuel_type", entete: { fr: "Carburant", en: "Fuel" }, obligatoire: true, choix: "fuel_type",
    description: { fr: "Carburant actuel (aucune valeur par défaut n'est appliquée).", en: "Current fuel (no default is applied)." },
    exemples: ["essence", "diesel", "diesel"] },
  { champ: "make", entete: { fr: "Marque", en: "Make" }, obligatoire: false,
    description: { fr: "Constructeur.", en: "Manufacturer." }, exemples: ["Toyota", "Ford", "International"] },
  { champ: "model", entete: { fr: "Modèle", en: "Model" }, obligatoire: false,
    description: { fr: "Modèle (sert à proposer la classe PNBV).", en: "Model (used to suggest the GVWR class)." },
    exemples: ["Corolla", "F-150", "HV607"] },
  { champ: "model_year", entete: { fr: "Année", en: "Year" }, obligatoire: false,
    description: { fr: "Année modèle (1950-2100).", en: "Model year (1950-2100)." }, exemples: [2017, 2015, 2012] },
  { champ: "annual_km", entete: { fr: "Km annuel", en: "Annual km" }, obligatoire: false,
    description: { fr: "Kilométrage annuel moyen. Absent : défaut de la catégorie (estimation).", en: "Average annual distance (km). Missing: category default (estimate)." },
    exemples: [12500, 22000, 9000] },
  { champ: "consumption_per_100km", entete: { fr: "Consommation", en: "Consumption" }, obligatoire: false,
    description: { fr: "Consommation réelle : L/100 km (diesel, essence), kWh/100 km (électrique), kg/100 km (hydrogène).", en: "Actual consumption: L/100 km (diesel, gasoline), kWh/100 km (electric), kg/100 km (hydrogen)." },
    exemples: [6.5, 16, 55] },
  { champ: "max_daily_km", entete: { fr: "Km journalier max", en: "Max daily km" }, obligatoire: false,
    description: { fr: "Kilométrage du jour le plus chargé (diagnostic hiver/autonomie).", en: "Distance on the busiest day (winter/range diagnosis)." },
    exemples: [80, 140, 120] },
  { champ: "depot", entete: { fr: "Garage", en: "Depot" }, obligatoire: false,
    description: { fr: "Garage d'attache : créé automatiquement s'il n'existe pas (bornes et raccordement par garage).", en: "Home depot: created automatically if missing (chargers and grid connection per depot)." },
    exemples: ["Hôtel de ville", "Travaux publics", "Travaux publics"] },
  { champ: "gvwr_class", entete: { fr: "Classe PNBV", en: "GVWR class" }, obligatoire: false, choix: "gvwr_class",
    description: { fr: "Classe de poids (barème exact des subventions) : classe, « classe 3 » ou PNBV en kg / lb.", en: "Weight class (exact subsidy scale): class, \"class 3\" or GVWR in kg / lb." },
    exemples: ["1", "2a", "8"] },
  { champ: "usage_profile", entete: { fr: "Usage", en: "Usage" }, obligatoire: false, choix: "usage_profile",
    description: { fr: "Profil d'usage.", en: "Usage profile." }, exemples: ["urbain", "urbain", "hors_route"] },
  { champ: "in_service_date", entete: { fr: "Mise en service", en: "In service date" }, obligatoire: false,
    description: { fr: "Date AAAA-MM-JJ (sert à proposer l'année de remplacement).", en: "Date YYYY-MM-DD (used to suggest the replacement year)." },
    exemples: ["2017-05-01", "2015-03-15", "2012-11-01"] },
  { champ: "status", entete: { fr: "Statut", en: "Status" }, obligatoire: false, choix: "status",
    description: { fr: "Statut (défaut : actif).", en: "Status (default: active)." }, exemples: ["actif", "actif", "actif"] },
  { champ: "vin", entete: { fr: "NIV", en: "VIN" }, obligatoire: false,
    description: { fr: "Numéro d'identification du véhicule (facultatif).", en: "Vehicle identification number (optional)." }, exemples: [null, null, null] },
  { champ: "department", entete: { fr: "Département", en: "Department" }, obligatoire: false,
    description: { fr: "Service utilisateur.", en: "User department." }, exemples: ["Administration", "Voirie", "Voirie"] },
  { champ: "notes", entete: { fr: "Notes", en: "Notes" }, obligatoire: false,
    description: { fr: "Texte libre (2000 caractères max).", en: "Free text (2000 characters max)." }, exemples: [null, null, null] },
];

function valeursDe(c: Colonne): string {
  if (!c.choix) return "";
  if (c.choix === "gvwr_class") return CLASSES_PNBV.join(", ");
  return Object.entries(valeursAcceptees()[c.choix])
    .map(([canon, syns]) => {
      const autres = syns.filter((s) => s !== canon);
      return autres.length ? `${canon} (${autres.join(", ")})` : canon;
    })
    .join(" ; ");
}

export interface ModeleImport {
  entetes: string[];
  exemples: Cellule[][];
  lisezMoi: Cellule[][];
}

export function modeleImport(langue: Langue): ModeleImport {
  const en = langue === "en";
  return {
    entetes: COLONNES.map((c) => c.entete[langue]),
    exemples: [0, 1, 2].map((i) => COLONNES.map((c) => c.exemples[i])),
    lisezMoi: [
      [en ? "H2Fleet — fleet import template" : "H2Fleet — modèle d'import de flotte"],
      [en
        ? "Fill in the first sheet (one row per vehicle; the 3 example rows can be replaced). Columns marked “yes” are required for a new vehicle. Headers may be in French or English; accents, case and spaces are ignored."
        : "Remplissez la première feuille (une ligne par véhicule ; les 3 lignes d'exemple peuvent être remplacées). Les colonnes « oui » sont obligatoires pour un nouveau véhicule. Entêtes en français ou en anglais ; accents, casse et espaces ignorés."],
      [en
        ? "No value is invented: an unreadable value stops the row with an explicit message; a missing consumption or distance uses the category default, shown as an estimate."
        : "Aucune valeur n'est inventée : une valeur illisible bloque la ligne avec un message explicite ; une consommation ou un kilométrage absent prend le défaut de la catégorie, affiché comme estimation."],
      [],
      en ? ["Column", "Required", "Description", "Accepted values (synonyms)", "Example"] : ["Colonne", "Obligatoire", "Description", "Valeurs acceptées (synonymes)", "Exemple"],
      ...COLONNES.map((c) => [
        c.entete[langue],
        c.obligatoire ? (en ? "yes" : "oui") : en ? "no" : "non",
        c.description[langue],
        valeursDe(c),
        c.exemples[0] ?? c.exemples[1] ?? "",
      ]),
    ],
  };
}

export function modeleCsv(langue: Langue): string {
  const m = modeleImport(langue);
  return Papa.unparse({ fields: m.entetes, data: m.exemples });
}
