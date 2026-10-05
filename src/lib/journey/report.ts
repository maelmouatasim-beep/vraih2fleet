/**
 * Étape 6 du parcours — Rapports : construction PURE des données
 * d'export. Le classeur Excel est décrit en lignes (aoa) testables ;
 * la conversion en fichier .xlsx (exceljs) se fait dans le composant.
 * Les totaux, sous-totaux, le TCO actualisé et la VAN sont de VRAIES
 * formules Excel (avec le résultat du moteur en cache) : un trésorier
 * peut suivre et refaire chaque calcul (point 12 de l'audit).
 * Tout vient du moteur (ResultatPlan) et du registre d'hypothèses —
 * aucune valeur recalculée à la main ici.
 */
import { DEFAUTS_CATEGORIES, ENGINE_VERSION, LISTE_HYPOTHESES, type CategorieVehicule, type ResultatPlan } from "@/lib/tco";
import {
  descriptionHypothese,
  traduireDonneeClient,
  traduireLibelleSubvention,
  type Langue,
} from "@/lib/tco/translations-en";
import { libelleStrategieRetenue, type StrategieConstruite, type StrategieRetenue } from "./strategies";
import { texteRecuperation } from "./payback";
import { texteExplication } from "./subsidy-explain";
import type { AnalyseEquite, ScenarioReduction } from "./fmv";
import { investissementCompare, LIBELLES_POSTES, POSTES_VAN } from "./synthese";
import { formateurCad } from "@/lib/format";
import { libelleUnite, valeurCelluleHypothese } from "./hypotheseAffichage";
import { sourcesCategorie } from "@/lib/library/liens";

/** Formule Excel (sans « = ») et résultat du moteur mis en cache. */
export interface CelluleFormule {
  formule: string;
  resultat: number;
}
/** Lien hypertexte (source d'une hypothèse). */
export interface CelluleLien {
  texte: string;
  lien: string;
}
export type Cellule = string | number | null | CelluleFormule | CelluleLien;

export const estFormule = (c: Cellule | undefined): c is CelluleFormule => typeof c === "object" && c !== null && "formule" in c;
export const estLien = (c: Cellule | undefined): c is CelluleLien => typeof c === "object" && c !== null && "lien" in c;

/** Valeur affichée d'une cellule : résultat d'une formule, texte d'un lien. */
export function valeurCellule(c: Cellule | undefined): string | number | null {
  if (c === undefined) return null;
  if (estFormule(c)) return c.resultat;
  if (estLien(c)) return c.texte;
  return c;
}

/** Lettre de colonne Excel (0 → A, 25 → Z, 26 → AA). */
export function colonneExcel(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const f = (formule: string, resultat: number): CelluleFormule => ({ formule, resultat });

/** Valeur exceljs d'une cellule : formule (avec résultat en cache), lien, ou valeur simple. */
export function valeurExcelJs(
  c: Cellule | undefined,
): string | number | null | { formula: string; result: number } | { text: string; hyperlink: string } {
  if (c === undefined) return null;
  if (estFormule(c)) return { formula: c.formule, result: c.resultat };
  if (estLien(c)) return { text: c.texte, hyperlink: c.lien };
  return c;
}

export interface FeuilleClasseur {
  nom: string;
  lignes: Cellule[][];
}

export interface MetaRapport {
  organisation: string;
  projet: string;
  dateIso: string; // AAAA-MM-JJ
  anneeReference: number;
  horizonAns: number;
  /** Taux d'actualisation RÉELLEMENT utilisé (paramètre du projet) :
   *  l'annexe l'affiche à la place du défaut du registre (revue A5). */
  tauxActualisationNominal: number;
  /** Libellés « donnée client » (couche 3, §3.3 v2.2) : champs saisis
   *  par le client qui PRIMENT sur les défauts du registre. */
  donneesClient?: string[];
  /** 1.6 — stratégie réellement retenue (nommée en tête du PDF et de l'Excel). */
  strategieRetenue?: StrategieRetenue;
  /** Phase 5.4 — pièces justificatives CONFIRMÉES (factures, devis) :
   *  citées en annexe avec leur empreinte et ce qu'elles ont modifié. */
  pieces?: PieceJustificative[];
  /** Exigences du Fonds municipal vert : analyse d'équité et scénario de
   *  réduction / redimensionnement de la stratégie retenue (./fmv.ts). */
  fmv?: { equite: AnalyseEquite; reduction: ScenarioReduction };
}

export const TEXTES_FMV = {
  fr: {
    feuille: "Fonds municipal vert",
    titre: "Exigences du Fonds municipal vert (FCM) — analyse d'équité et scénario de réduction de la flotte",
    equite: "ANALYSE D'ÉQUITÉ — répartition des bénéfices de la stratégie retenue (moteur : véhicules du groupe seuls ; infrastructure partagée présentée par secteur)",
    colonnesService: ["Service", "Véhicules", "Zéro émission", "CO2e évité à l'échappement (t)", "CO2e évité, cycle complet (t)", "VAN des véhicules ($)"],
    colonnesSecteur: ["Secteur (garage)", "Véhicules", "Zéro émission", "CO2e évité à l'échappement (t)", "CO2e évité, cycle complet (t)", "VAN des véhicules ($)", "Infrastructure du secteur ($)"],
    nonRenseigne: "Non renseigné",
    partTransport: "Part du CO2e évité à l'échappement portée par le transport collectif (service utilisé directement par la population)",
    aDocumenter: "À documenter par la municipalité (non calculé par l'outil) :",
    questions: {
      quartiers: "Quartiers et populations desservis par les véhicules électrifiés, dont les populations vulnérables.",
      qualite_air: "Effet sur la qualité de l'air et le bruit dans les secteurs les plus exposés (abords des garages, circuits d'autobus).",
      emploi: "Formation et requalification des mécaniciens ; emplois locaux.",
      accessibilite: "Accessibilité universelle des véhicules de service public.",
      cout_citoyens: "Effet sur les taxes ou les tarifs payés par les citoyens.",
      consultation: "Consultation des employés et de la population.",
    } as Record<string, string>,
    reduction: (seuil: number) =>
      `SCÉNARIO DE RÉDUCTION / REDIMENSIONNEMENT — véhicules dont le km/an est inférieur à ${Math.round(seuil * 100)} % du km/an type de leur catégorie (seuil du registre « sous-utilisation de la flotte », à valider)`,
    colonnesReduction: ["Unité", "Catégorie", "km/an", "km/an type", "Utilisation", "Technologie prévue", "Coût total actualisé évité si non remplacé ($)", "CO2e évité, cycle complet (t)", "Remarque"],
    aJuger: "service saisonnier ou d'urgence : à juger par le service",
    aucunCandidat: "Aucun véhicule sous le seuil d'utilisation.",
    totalReduction: (n: number, total: number) => `Total — ${n} ${n === 1 ? "véhicule" : "véhicules"} sur ${total}`,
    hypotheseReduction: "Hypothèse : les déplacements des véhicules retirés sont absorbés par le parc restant (autopartage interne) ; le kilométrage reporté n'est pas chiffré.",
    pistes: "Pistes de redimensionnement — véhicule plus petit, si l'usage le permet (à confirmer par le service) :",
    colonnesPistes: ["Unité", "Catégorie actuelle", "Catégorie proposée", "Économie actualisée ($)"],
  },
  en: {
    feuille: "Green Municipal Fund",
    titre: "Green Municipal Fund (FCM) requirements — equity analysis and fleet reduction scenario",
    equite: "EQUITY ANALYSIS — distribution of the retained strategy's benefits (engine: the group's vehicles only; shared infrastructure shown by sector)",
    colonnesService: ["Department", "Vehicles", "Zero-emission", "Exhaust CO2e avoided (t)", "Full-cycle CO2e avoided (t)", "Vehicles NPV ($)"],
    colonnesSecteur: ["Sector (depot)", "Vehicles", "Zero-emission", "Exhaust CO2e avoided (t)", "Full-cycle CO2e avoided (t)", "Vehicles NPV ($)", "Sector infrastructure ($)"],
    nonRenseigne: "Not specified",
    partTransport: "Share of exhaust CO2e avoided carried by public transit (a service residents use directly)",
    aDocumenter: "To be documented by the municipality (not computed by the tool):",
    questions: {
      quartiers: "Neighbourhoods and populations served by the electrified vehicles, including vulnerable populations.",
      qualite_air: "Effect on air quality and noise in the most exposed areas (around depots, bus routes).",
      emploi: "Training and reskilling of mechanics; local jobs.",
      accessibilite: "Universal accessibility of public service vehicles.",
      cout_citoyens: "Effect on taxes or fees paid by residents.",
      consultation: "Consultation of employees and residents.",
    } as Record<string, string>,
    reduction: (seuil: number) =>
      `FLEET REDUCTION / RIGHT-SIZING SCENARIO — vehicles driven less than ${Math.round(seuil * 100)}% of their category's typical annual mileage (registry threshold “fleet under-use”, to validate)`,
    colonnesReduction: ["Unit", "Category", "km/yr", "Typical km/yr", "Utilization", "Planned technology", "Discounted total cost avoided if not replaced ($)", "Full-cycle CO2e avoided (t)", "Note"],
    aJuger: "seasonal or emergency service: to be judged by the department",
    aucunCandidat: "No vehicle below the utilization threshold.",
    totalReduction: (n: number, total: number) => `Total — ${n} ${n === 1 ? "vehicle" : "vehicles"} out of ${total}`,
    hypotheseReduction: "Assumption: trips of the retired vehicles are absorbed by the remaining fleet (internal car sharing); the shifted mileage is not costed.",
    pistes: "Right-sizing options — a smaller vehicle, if the use allows it (to be confirmed by the department):",
    colonnesPistes: ["Unit", "Current category", "Proposed category", "Discounted savings ($)"],
  },
};

const CATEGORIES_EN: Record<string, string> = {
  vehicule_leger: "Light vehicle",
  camionnette: "Pickup / van",
  camion_moyen: "Medium truck",
  camion_lourd: "Heavy truck",
  autobus_urbain_12m: "12 m urban bus",
};

const TECHNOS: Record<Langue, Record<string, string>> = {
  fr: { diesel: "Thermique neuf (statu quo)", BEV: "Électrique (batterie)", FCEV: "Hydrogène (pile à combustible)" },
  en: { diesel: "New combustion (status quo)", BEV: "Battery electric", FCEV: "Hydrogen fuel cell" },
};

/** Technologie en clair (jamais le code brut « BEV » dans un export). */
export function libelleTechnologie(techno: string, langue: Langue): string {
  return TECHNOS[langue][techno] ?? techno;
}

/** Arrondi des nombres d'un export : 2 décimales (montants), 4 sous 100
 *  (taux, prix unitaires) — aucun 5401606.875000001 dans un classeur. */
export function arrondirCellule<T>(c: T): T {
  if (estFormule(c as Cellule)) {
    const x = c as unknown as CelluleFormule;
    return { ...x, resultat: arrondirCellule(x.resultat) } as T;
  }
  if (typeof c !== "number" || !Number.isFinite(c) || Number.isInteger(c)) return c;
  const d = Math.abs(c) >= 100 ? 100 : 10_000;
  return (Math.round(c * d) / d) as T;
}

export function libelleCategorie(c: CategorieVehicule, langue: Langue): string {
  return langue === "en" ? CATEGORIES_EN[c] ?? c : DEFAUTS_CATEGORIES[c].libelle;
}

/** Feuille « Fonds municipal vert » : équité + scénario de réduction. */
export function feuilleFondsMunicipalVert(
  fmv: NonNullable<MetaRapport["fmv"]>,
  unites: Map<string, string>,
  langue: Langue,
): FeuilleClasseur {
  const t = TEXTES_FMV[langue];
  const { equite, reduction } = fmv;
  const lignes: Cellule[][] = [
    [t.titre],
    [],
    [t.equite],
    t.colonnesService,
    ...equite.parService.map((l): Cellule[] => [
      l.libelle ?? t.nonRenseigne,
      l.vehicules,
      l.zeroEmission,
      Math.round(l.co2TtwEviteTonnes),
      Math.round(l.co2WtwEviteTonnes),
      Math.round(l.vanVehicules),
    ]),
    [],
    t.colonnesSecteur,
    ...equite.parSecteur.map((l): Cellule[] => [
      l.libelle ?? t.nonRenseigne,
      l.vehicules,
      l.zeroEmission,
      Math.round(l.co2TtwEviteTonnes),
      Math.round(l.co2WtwEviteTonnes),
      Math.round(l.vanVehicules),
      Math.round(l.infraCapex),
    ]),
    [],
    [t.partTransport, equite.partTransportCollectifCo2 == null ? "—" : `${Math.round(equite.partTransportCollectifCo2 * 100)} %`],
    [],
    [t.aDocumenter],
    ...equite.questions.map((q): Cellule[] => [`• ${t.questions[q]}`]),
    [],
    [t.reduction(reduction.seuil)],
    t.colonnesReduction,
    ...(reduction.candidats.length === 0
      ? [[t.aucunCandidat]]
      : reduction.candidats.map((c): Cellule[] => [
          unites.get(c.id) ?? c.unit_number ?? c.id,
          libelleCategorie(c.categorie, langue),
          c.kmParAn,
          c.kmParAnType,
          `${Math.round(c.ratio * 100)} %`,
          libelleTechnologie(c.technologie, langue),
          Math.round(c.tcoEvite),
          Math.round(c.co2WtwEviteTonnes),
          c.aJugerParLeService ? t.aJuger : "",
        ])),
    [
      t.totalReduction(reduction.candidats.length, reduction.vehiculesDuPlan),
      null,
      null,
      null,
      null,
      null,
      Math.round(reduction.tcoEviteTotal),
      Math.round(reduction.co2WtwEviteTotal),
    ],
    [t.hypotheseReduction],
    [],
    [t.pistes],
    t.colonnesPistes,
    ...reduction.pistes.map((p): Cellule[] => [
      unites.get(p.id) ?? p.unit_number ?? p.id,
      libelleCategorie(p.de, langue),
      libelleCategorie(p.vers, langue),
      Math.round(p.economie),
    ]),
  ];
  return { nom: t.feuille, lignes };
}

export interface PieceJustificative {
  type: "fuel_invoice" | "electricity_invoice" | "vehicle_quote" | "charger_quote" | "grid_quote";
  fournisseur: string | null;
  date: string | null;
  fichier: string;
  /** SHA-256 complet (le rapport en affiche les 12 premiers caractères). */
  empreinte: string;
  confirmeeLe: string | null;
  /** Valeurs appliquées : « cible · champ : avant → après ». */
  valeurs: { cible: string; champ: string; avant: string | number | null; apres: string | number | null }[];
}

const LIBELLES_PIECES = {
  fr: {
    fuel_invoice: "Facture de carburant",
    electricity_invoice: "Facture Hydro-Québec",
    vehicle_quote: "Devis de véhicule",
    charger_quote: "Devis de bornes",
    grid_quote: "Devis de raccordement",
  },
  en: {
    fuel_invoice: "Fuel invoice",
    electricity_invoice: "Hydro-Québec invoice",
    vehicle_quote: "Vehicle quote",
    charger_quote: "Charger quote",
    grid_quote: "Grid-connection quote",
  },
} as const;

const CHAMPS_PIECES = {
  fr: {
    diesel_price_per_l: "prix du diesel ($/L avant taxes)",
    electricity_cost_per_kwh: "coût de l'électricité ($/kWh avant taxes)",
    hq_rate: "tarif Hydro-Québec",
    grid_connection_quote: "devis de raccordement ($ avant taxes)",
    quote_price: "prix d'achat devisé ($ avant taxes)",
    "charger_unit_quote.niveau2": "coût par borne niveau 2 ($ avant taxes)",
    "charger_unit_quote.rapide50": "coût par borne rapide 50 kW ($ avant taxes)",
    "charger_unit_quote.rapide150": "coût par borne rapide 150 kW ($ avant taxes)",
  },
  en: {
    diesel_price_per_l: "diesel price ($/L before taxes)",
    electricity_cost_per_kwh: "electricity cost ($/kWh before taxes)",
    hq_rate: "Hydro-Québec rate",
    grid_connection_quote: "grid-connection quote ($ before taxes)",
    quote_price: "quoted purchase price ($ before taxes)",
    "charger_unit_quote.niveau2": "cost per Level 2 charger ($ before taxes)",
    "charger_unit_quote.rapide50": "cost per 50 kW fast charger ($ before taxes)",
    "charger_unit_quote.rapide150": "cost per 150 kW fast charger ($ before taxes)",
  },
} as const;

export function libelleChampPiece(champ: string, langue: Langue): string {
  return (CHAMPS_PIECES[langue] as Record<string, string>)[champ] ?? champ;
}

/** « cible · champ : avant → après » pour chaque valeur appliquée par la pièce. */
export function valeursPiece(p: PieceJustificative, langue: Langue): string {
  return p.valeurs.map((v) => `${v.cible} · ${libelleChampPiece(v.champ, langue)} : ${v.avant ?? "—"} → ${v.apres ?? "—"}`).join(" ; ");
}

export function libellePiece(type: PieceJustificative["type"], langue: Langue): string {
  return LIBELLES_PIECES[langue][type];
}

/** Ligne lisible d'une pièce : « Facture de carburant — Fournisseur, 2026-09-15 — fichier (SHA-256 abc…) ». */
export function lignePiece(p: PieceJustificative, langue: Langue): string {
  const qui = [p.fournisseur, p.date].filter(Boolean).join(", ");
  return `${libellePiece(p.type, langue)}${qui ? ` — ${qui}` : ""} — ${p.fichier} (SHA-256 ${p.empreinte.slice(0, 12)}…)`;
}

const L = {
  fr: {
    titre: (p: string, o: string) => `Plan de remplacement — ${p} (${o})`,
    genere: (d: string, v: string, e: string) => `Généré le ${d} — moteur H2Fleet ${v} — empreinte ${e}`,
    strategie: (s: string) => `Stratégie retenue : ${s}`,
    note: "Dollars courants (vue budgétaire). Écart positif = le plan coûte moins cher que le statu quo.",
    colonnesBudget: ["Année", "Investissement (PTI)", "Subventions", "Reste à financer", "Fonctionnement", "Valeurs résiduelles", "Net plan", "Net statu quo", "Écart"],
    total: "Total",
    taux: "Taux d'actualisation nominal (paramètre du projet)",
    noteFormules: "Les colonnes D, G et I, la ligne Total, le TCO actualisé (VAN au taux ci-dessus), l'économie et les totaux sont des formules : modifiez une valeur pour voir l'effet. Les résultats affichés à l'ouverture sont ceux du moteur H2Fleet.",
    titrePrix: "PRIX D'ACHAT PAR DÉFAUT, PAR CATÉGORIE (avant taxes, dollars canadiens de 2026 ; un devis saisi les remplace)",
    colonnesPrix: ["Catégorie", "Thermique neuf ($)", "Électrique ($)", "Hydrogène ($)", "Plage électrique ($)", "Durée de vie (ans)", "Sources", "Adresse des sources"],
    tcoPlan: "TCO actualisé du plan",
    tcoSq: "TCO actualisé du statu quo",
    van: "Économie (VAN)",
    co2: "CO2e évité — cycle complet, puits à la roue (t) — retenu dans les totaux",
    co2Ttw: "CO2e évité — à l'échappement, réservoir à la roue (t)",
    payback: "Délai de récupération actualisé (ans)",
    invBrut: "Investissement total du plan (dollars courants)",
    invSq: "Investissement du statu quo — mêmes remplacements en thermique neuf (dollars courants)",
    invEcart: "Écart d'investissement : plan − statu quo",
    titreDecomposition: "D'OÙ VIENT L'ÉCART — VAN par poste (positif = le plan coûte moins cher ; subventions et valeur de revente sont des recettes ; méthodologie §6.4)",
    colonnesDecomposition: ["Poste", "Économie actualisée ($)"],
    totalDecomposition: "Total = VAN",
    colonnesVehicules: ["Unité", "Technologie cible", "Année d'achat", "km/an retenus", "Durée de vie (ans)", "Prix avant taxes (réf. diesel)", "Prix avant taxes (cible)", "Subventions retenues", "Total subventions", "Règle appliquée et raison (programme par programme)"],
    an: "an",
    sites: ["Infrastructure par garage (avant taxes)", "Bornes", "kW demandés", "kW disponibles", "Palier", "Raccordement", "Station H2", "Total"],
    presume: "présumés",
    sansGarage: "Garage non précisé",
    totalInfra: "Infrastructure totale",
    titreHyp: "Hypothèses du registre (docs/tco-methodologie.md §8 — statuts honnêtes)",
    donneesClient: "DONNÉES CLIENT (elles priment sur les défauts du registre ci-dessous) :",
    colonnesHyp: ["Identifiant", "Description", "Valeur", "Unité", "Statut", "Source", "Année", "Vérifiée le", "Adresse de la source"],
    parametreProjet: "paramètre du projet",
    statuts: { verifie: "vérifié", estimation: "estimation", a_valider: "à valider" } as Record<string, string>,
    feuilles: ["Plan annuel", "Véhicules", "Hypothèses"],
    pieces: "PIÈCES JUSTIFICATIVES (confirmées par l'organisation, conservées avec leur empreinte) :",
    colonnesPieces: ["Pièce", "Valeurs appliquées"],
  },
  en: {
    titre: (p: string, o: string) => `Replacement plan — ${p} (${o})`,
    genere: (d: string, v: string, e: string) => `Generated on ${d} — H2Fleet engine ${v} — fingerprint ${e}`,
    strategie: (s: string) => `Selected strategy: ${s}`,
    note: "Current dollars (budget view). Positive difference = the plan costs less than the status quo.",
    colonnesBudget: ["Year", "Investment (capital)", "Subsidies", "Remaining to finance", "Operations", "Residual values", "Plan net", "Status quo net", "Difference"],
    total: "Total",
    taux: "Nominal discount rate (project setting)",
    noteFormules: "Columns D, G and I, the Total row, the discounted TCO (NPV at the rate above), the savings and the totals are formulas: change a value to see the effect. The results shown on opening are those of the H2Fleet engine.",
    titrePrix: "DEFAULT PURCHASE PRICES BY CATEGORY (before taxes, 2026 Canadian dollars; an entered quote replaces them)",
    colonnesPrix: ["Category", "New combustion ($)", "Electric ($)", "Hydrogen ($)", "Electric range ($)", "Service life (years)", "Sources", "Source addresses"],
    tcoPlan: "Plan discounted TCO",
    tcoSq: "Status quo discounted TCO",
    van: "Savings (NPV)",
    co2: "CO2e avoided — full cycle, well-to-wheel (t) — used in totals",
    co2Ttw: "CO2e avoided — exhaust, tank-to-wheel (t)",
    payback: "Discounted payback (years)",
    invBrut: "Total investment of the plan (current dollars)",
    invSq: "Investment of the status quo — same replacements with new combustion vehicles (current dollars)",
    invEcart: "Investment gap: plan − status quo",
    titreDecomposition: "WHERE THE GAP COMES FROM — NPV by cost item (positive = the plan costs less; subsidies and resale value are revenues; methodology §6.4)",
    colonnesDecomposition: ["Cost item", "Discounted savings ($)"],
    totalDecomposition: "Total = NPV",
    colonnesVehicules: ["Unit", "Target technology", "Purchase year", "km/yr used", "Lifetime (years)", "Price before taxes (diesel ref.)", "Price before taxes (target)", "Subsidies used", "Total subsidies", "Rule applied and reason (program by program)"],
    an: "year",
    sites: ["Infrastructure by depot (before taxes)", "Chargers", "kW requested", "kW available", "Tier", "Grid connection", "H2 station", "Total"],
    presume: "presumed",
    sansGarage: "Depot not specified",
    totalInfra: "Total infrastructure",
    titreHyp: "Registry assumptions (docs/tco-methodologie.md §8 — honest statuses)",
    donneesClient: "CLIENT DATA (takes priority over the registry defaults below):",
    colonnesHyp: ["Identifier", "Description", "Value", "Unit", "Status", "Source", "Year", "Checked on", "Source address"],
    parametreProjet: "project setting",
    statuts: { verifie: "verified", estimation: "estimate", a_valider: "to validate" } as Record<string, string>,
    feuilles: ["Annual plan", "Vehicles", "Assumptions"],
    pieces: "SUPPORTING DOCUMENTS (confirmed by the organization, kept with their fingerprint):",
    colonnesPieces: ["Document", "Values applied"],
  },
};

/** Classeur du plan : budget annuel, véhicules/subventions, hypothèses. */
export function construireClasseurPlan(
  strategie: StrategieConstruite,
  unites: Map<string, string>,
  meta: MetaRapport,
  langue: Langue = "fr",
): FeuilleClasseur[] {
  const l = L[langue];
  const resultat = strategie.resultat as ResultatPlan;
  const plan = strategie.plan!;

  // Plan annuel : lignes 1 à 6 = en-tête ; données à partir de la ligne 7.
  // Colonnes : A année, B investissement, C subventions, D reste à financer
  // (= B − C), E fonctionnement, F valeurs résiduelles, G net du plan
  // (= D + E − F), H net du statu quo, I écart (= H − G).
  const vue = resultat.vueBudgetaire;
  const L0 = 7;
  const Ln = L0 + vue.length - 1;
  const ligneTotal = Ln + 1;
  const somme = (col: string, valeurs: number[]) => f(`SUM(${col}${L0}:${col}${Ln})`, valeurs.reduce((a, b) => a + b, 0));
  // Bloc de synthèse : ligne vide après le total, puis taux, TCO, VAN…
  const lTaux = ligneTotal + 2;
  const lTcoPlan = lTaux + 1;
  const lTcoSq = lTaux + 2;
  const lInvBrut = lTaux + 4;
  const lInvSq = lTaux + 5;
  const npv = (col: string) =>
    vue.length > 1 ? `${col}${L0}+NPV($B$${lTaux},${col}${L0 + 1}:${col}${Ln})` : `${col}${L0}`;
  const inv = investissementCompare(resultat);
  // Taux RÉELLEMENT utilisé par le moteur pour ce résultat (= paramètre du projet).
  const tauxMoteur = plan.parametres.tauxActualisationNominal ?? meta.tauxActualisationNominal;
  const budget: Cellule[][] = [
    [l.titre(meta.projet, meta.organisation)],
    [l.genere(meta.dateIso, ENGINE_VERSION, resultat.empreinteEntree)],
    [l.strategie(libelleStrategieRetenue(meta.strategieRetenue ?? { cle: null, ecarts: 0 }, langue))],
    [l.note],
    [],
    l.colonnesBudget,
    ...vue.map((v, i): Cellule[] => {
      const r = L0 + i;
      return [
        v.annee,
        v.investissementAlt,
        v.subventionsAlt,
        f(`B${r}-C${r}`, v.resteAFinancerAlt),
        v.fonctionnementAlt,
        v.residuelsAlt,
        f(`D${r}+E${r}-F${r}`, v.netAlt),
        v.netRef,
        f(`H${r}-G${r}`, v.ecart),
      ];
    }),
    [
      l.total,
      somme("B", vue.map((v) => v.investissementAlt)),
      somme("C", vue.map((v) => v.subventionsAlt)),
      somme("D", vue.map((v) => v.resteAFinancerAlt)),
      somme("E", vue.map((v) => v.fonctionnementAlt)),
      somme("F", vue.map((v) => v.residuelsAlt)),
      somme("G", vue.map((v) => v.netAlt)),
      somme("H", vue.map((v) => v.netRef)),
      somme("I", vue.map((v) => v.ecart)),
    ],
    [],
    [l.taux, tauxMoteur],
    [l.tcoPlan, f(npv("G"), resultat.alternative.tcoActualise)],
    [l.tcoSq, f(npv("H"), resultat.reference.tcoActualise)],
    [l.van, f(`B${lTcoSq}-B${lTcoPlan}`, resultat.vanDifferentielle)],
    [l.invBrut, f(`B${ligneTotal}`, inv.brut)],
    [l.invSq, inv.statuQuo],
    [l.invEcart, f(`B${lInvBrut}-B${lInvSq}`, inv.surcout)],
    [l.co2Ttw, resultat.co2EviteTtwTonnes],
    [l.co2, resultat.co2EviteWtwTonnes],
    [
      l.payback,
      resultat.paybackActualise.annees ?? texteRecuperation(resultat.paybackActualise, resultat.horizonAns, langue === "en"),
    ],
    [],
    [l.titreDecomposition],
    [l.colonnesDecomposition[0], l.colonnesDecomposition[1]],
  ];
  const lPoste0 = budget.length + 1;
  budget.push(...POSTES_VAN.map((p): Cellule[] => [LIBELLES_POSTES[langue][p], resultat.decompositionVan[p]]));
  budget.push([l.totalDecomposition, f(`SUM(B${lPoste0}:B${lPoste0 + POSTES_VAN.length - 1})`, resultat.vanDifferentielle)]);
  budget.push([], [l.noteFormules]);

  const vehicules: Cellule[][] = [
    l.colonnesVehicules,
    ...plan.vehicules.map((v) => {
      const subventions = v.subventionsAlternative ?? [];
      return [
        unites.get(v.id) ?? v.id,
        libelleTechnologie(v.alternative.technologie, langue),
        meta.anneeReference + (v.anneeAcquisition ?? 0),
        v.kmParAn,
        v.dureeVieAns,
        v.reference.prixAvantTaxes,
        v.alternative.prixAvantTaxes,
        subventions
          .map((s) => `${traduireLibelleSubvention(s.libelle, langue)}${langue === "en" ? ":" : "\u00a0:"} ${formateurCad(langue).format(s.montant)} (${l.an} ${s.annee})`)
          .join(" ; ") || "—",
        subventions.reduce((a, s) => a + s.montant, 0),
        (strategie.explicationsSubventions[v.id] ?? []).map((e) => texteExplication(e, langue)).join(" ; ") || "—",
      ];
    }),
    [],
    l.sites,
  ];
  // MÊME plan par garage que Stratégies, Plan, Financement et PDF. Total
  // du garage = bornes + raccordement + station (formule) ; total général
  // = somme des garages (formule) — sinon la valeur du moteur.
  const lSite0 = vehicules.length + 1;
  const garages = strategie.infra.garages;
  vehicules.push(
    ...garages.map((g, i): Cellule[] => {
      const r = lSite0 + i;
      const additif = Math.abs(g.capexBornes + g.raccordement.cout + g.capexStationH2 - g.capexTotal) < 0.01;
      return [
        g.depot ?? l.sansGarage,
        g.capexBornes,
        g.raccordement.kwDemandes,
        g.raccordement.kwDisponiblesSource === "presumee"
          ? `${g.raccordement.kwDisponibles} (${l.presume})`
          : g.raccordement.kwDisponibles,
        g.raccordement.palier,
        g.raccordement.cout,
        g.capexStationH2,
        additif ? f(`B${r}+F${r}+G${r}`, g.capexTotal) : g.capexTotal,
      ];
    }),
  );
  const sommeGarages = garages.reduce((a, g) => a + g.capexTotal, 0);
  vehicules.push([
    l.totalInfra,
    null,
    null,
    null,
    null,
    null,
    null,
    garages.length > 0 && Math.abs(sommeGarages - strategie.infra.totalCapex) < 0.01
      ? f(`SUM(H${lSite0}:H${lSite0 + garages.length - 1})`, strategie.infra.totalCapex)
      : strategie.infra.totalCapex,
  ]);

  const hypotheses: Cellule[][] = [
    [l.titreHyp],
    ...(meta.donneesClient && meta.donneesClient.length > 0
      ? [
          [],
          [l.donneesClient],
          ...meta.donneesClient.map((d): Cellule[] => [traduireDonneeClient(d, langue)]),
        ]
      : []),
    ...(meta.pieces && meta.pieces.length > 0
      ? [
          [],
          [l.pieces],
          l.colonnesPieces,
          ...meta.pieces.map((p): Cellule[] => [
            lignePiece(p, langue),
            valeursPiece(p, langue) || "—",
          ]),
        ]
      : []),
    [],
    l.colonnesHyp,
    ...LISTE_HYPOTHESES.map((h) => [
      h.id,
      descriptionHypothese(h.id, langue),
      // Le taux d'actualisation affiché est celui RÉELLEMENT utilisé
      // (paramètre du projet), pas le défaut du registre (revue A5).
      valeurCelluleHypothese(h.id === "taux_actualisation_nominal" ? meta.tauxActualisationNominal : h.valeur, h.unite),
      libelleUnite(h.unite, langue),
      h.id === "taux_actualisation_nominal"
        ? l.parametreProjet
        : (l.statuts[h.statut] ?? h.statut),
      `${h.source.organisme} — ${h.source.document}${h.source.tableauOuPage ? `, ${h.source.tableauOuPage}` : ""}`,
      h.source.annee,
      h.dateVerification,
      h.source.url ? { texte: h.source.url, lien: h.source.url } : "—",
    ]),
    [],
    [l.titrePrix],
    l.colonnesPrix,
    ...(Object.keys(DEFAUTS_CATEGORIES) as CategorieVehicule[]).map((cat): Cellule[] => {
      const d = DEFAUTS_CATEGORIES[cat];
      const sources = sourcesCategorie(cat);
      return [
        libelleCategorie(cat, langue),
        d.prixAchat.diesel.valeur,
        d.prixAchat.BEV.valeur,
        d.prixAchat.FCEV.valeur,
        `${d.prixAchat.BEV.plage.basse} – ${d.prixAchat.BEV.plage.haute}`,
        d.dureeVieAns,
        sources.map((x) => x.texte + (x.aValider ? ` (${l.statuts.a_valider})` : "")).join(" ; "),
        ...sources.filter((x) => x.url).map((x): Cellule => ({ texte: x.url!, lien: x.url! })),
      ];
    }),
  ];

  return [
    { nom: l.feuilles[0], lignes: budget },
    { nom: l.feuilles[1], lignes: vehicules },
    ...(meta.fmv ? [feuilleFondsMunicipalVert(meta.fmv, unites, langue)] : []),
    { nom: l.feuilles[2], lignes: hypotheses },
  ].map((f) => ({ ...f, lignes: f.lignes.map((ligne) => ligne.map(arrondirCellule)) }));
}
