/**
 * E2 — Traductions ANGLAISES des textes produits par le registre et le
 * moteur (le registre reste rédigé en français : c'est la source). Clés
 * = identifiants du registre ; un test exige une entrée pour CHAQUE
 * hypothèse, programme et paramètre du stress test, pour qu'aucun
 * nouvel élément ne parte en français dans un rapport anglais (d'où
 * l'absence de repli : une entrée manquante fait échouer ce test).
 * Les montants et dates ne sont jamais traduits ni recalculés ici.
 */
import { LISTE_HYPOTHESES, PROGRAMMES } from "./index";

export type Langue = "fr" | "en";

export const HYPOTHESES_EN: Record<string, string> = {
  prix_diesel: "Diesel price EXCLUDING GST/QST (excise and cap-and-trade included) — StatCan 12-MONTH MOVING AVERAGE, Montréal/Québec",
  hq_tarif_m_energie: "Hydro-Québec rate M — energy price (first block, ≤ 210,000 kWh/month)",
  hq_tarif_m_puissance: "Hydro-Québec rate M — monthly demand charge",
  hq_tarif_g_energie: "Hydro-Québec rate G — energy price (first block, ≤ 15,090 kWh/month)",
  cout_effectif_elec_depot: "Effective electricity cost at the depot (energy + amortized demand charge), spread-out overnight charging",
  prix_h2_livre: "Delivered hydrogen price at the pump/depot",
  rendement_recharge: "Charging efficiency (battery kWh ÷ metered kWh)",
  majoration_hivernale_bev: "Increase in electricity consumption in winter conditions (during winter months)",
  part_km_hiver: "Share of annual mileage driven in winter conditions",
  inflation_generale: "General inflation (CPI) — indexation of maintenance, insurance, future purchase prices",
  inflation_diesel: "Diesel-specific price inflation",
  inflation_electricite: "Electricity-specific price inflation (Hydro-Québec general rates)",
  inflation_h2: "Annual change in delivered hydrogen price",
  inflation_entretien: "Maintenance-specific cost inflation (labour + parts)",
  taux_actualisation_nominal: "Default NOMINAL discount rate (long-term municipal borrowing cost)",
  fe_diesel_ttw_lourds: "Tank-to-wheel emission factor, diesel, heavy vehicles (CO2+CH4+N2O)",
  fe_diesel_ttw_legers: "Tank-to-wheel emission factor, diesel, light vehicles and light trucks",
  fe_diesel_amont: "Diesel well-to-tank surcharge (extraction, refining, transport), as a share of TTW",
  fe_reseau_qc: "GHG intensity of Québec's electricity grid (consumption)",
  fe_h2_electrolyse_qc: "Well-to-wheel emission factor, H2 from electrolysis in Québec",
  fe_h2_smr: "Well-to-wheel emission factor, H2 from steam methane reforming (SMR) without capture",
  cout_social_carbone_2026: "Social cost of carbon (SC-CO2) for 2026 — valued OUTSIDE the TCO",
  taux_tps: "GST rate",
  taux_tvq: "QST rate",
  taux_recup_tps_municipalite: "Share of GST rebated to municipalities",
  taux_recup_tvq_municipalite: "Share of QST rebated to municipalities (invoices since 2015)",
  depreciation_diesel: "Annual (geometric) depreciation rate — diesel vehicles",
  depreciation_bev: "Annual (geometric) depreciation rate — battery electric vehicles",
  depreciation_fcev: "Annual (geometric) depreciation rate — fuel cell vehicles",
  plancher_residuel: "Residual value floor (scrap/parts value), as a share of the purchase price",
  borne_niveau2_installee: "Level 2 charger (7-19 kW) installed at the depot (hardware + installation)",
  borne_rapide_50kw_installee: "~50 kW DC fast charger installed (hardware + installation)",
  borne_rapide_150kw_installee: "~150 kW DC fast charger installed (hardware + installation)",
  prix_essence: "Regular gasoline price EXCLUDING GST/QST (fuel taxes and cap-and-trade included) — 12-month StatCan average, Montréal/Québec",
  fe_essence_ttw_legers: "Tank-to-wheel emission factor, gasoline, new light-duty vehicles and trucks (tier 3)",
  raccordement_depot: "Depot grid connection and electrical upgrade (service entrance, transformer, distribution)",
  puissance_disponible_garage_presumee: "Presumed spare electrical capacity of an existing depot, when the depot's actual available power is not entered",
  raccordement_seuil_palier1_kw: "Grid connection — upper limit of tier 1 (power needed beyond the depot's available capacity)",
  raccordement_seuil_palier2_kw: "Grid connection — upper limit of tier 2 (above: tier 3)",
  raccordement_palier1: "Electrical upgrade — tier 1: up to 50 kW extra (circuits and panel, no new service entrance)",
  raccordement_palier2: "Electrical upgrade — tier 2: 50 to 250 kW extra (new service entrance or transformer)",
  raccordement_palier3: "Electrical upgrade — tier 3: more than 250 kW extra (dedicated supply, substation)",
  entretien_infra_ratio: "Annual charging infrastructure maintenance, as a share of capital",
  duree_vie_infra: "Charging infrastructure lifetime",
  station_h2_depot: "Depot H2 refuelling station (medium capacity, turnkey)",
  trajectoire_prix_batterie: "Expected annual decline in battery pack prices (disabled by default in the engine)",
  taux_change_usd_cad: "USD → CAD exchange rate (vehicles imported from the U.S.)",
  droits_douane_ve_chine: "Customs duties on China-made EVs (February 2026 quota regime)",
};

export const PROGRAMMES_EN: Record<string, { nom: string; cumul: string }> = {
  pave: {
    nom: "EVAP — Electric Vehicle Affordability Program (federal)",
    cumul: "Stackable with Roulez vert (programs at different levels).",
  },
  roulez_vert: {
    nom: "Roulez vert (Québec) — new vehicle",
    cumul: "Stackable with the federal EVAP.",
  },
  ecocamionnage_v1: {
    nom: "Écocamionnage stream 1 (Québec, MTMD) — vehicle acquisition",
    cumul:
      "“A vehicle may receive only one financial aid” within the program (verified, 6.1.6). Art. 7.14.2 (VERIFIED): total public aid (Québec and Canada, tax credits included) may not exceed 75% of eligible expenses; any excess is deducted from the program's aid — the applicant's minimum contribution is 25%.",
  },
  imhzev: {
    nom: "iMHZEV (federal) — medium and heavy vehicles",
    cumul: "N/A (closed).",
  },
  pivez: {
    nom: "ZEVIP (federal, NRCan) — charging infrastructure",
    cumul: "Total public aid capped under the program terms (to be confirmed by call for proposals).",
  },
  ftcze: {
    nom: "ZETF — Zero Emission Transit Fund (federal, HICC)",
    cumul: "Combines with Canada Infrastructure Bank financing (bus loans).",
  },
  pagtcp: {
    nom: "Government public transit assistance program (Québec, MTMD) — bus electrification",
    cumul: "Combined with the federal ZETF in recent projects (e.g. ATUQ orders).",
  },
};

export const PARAMETRES_STRESS_EN: Record<string, string> = {
  prix_diesel: "Diesel price ($/L)",
  prix_electricite: "Effective electricity cost ($/kWh)",
  prix_achat_alternative: "Zero-emission vehicle purchase price (factor)",
  capex_infrastructure: "Infrastructure and grid-connection cost (factor)",
  subventions: "Subsidies obtained (share of planned amounts)",
  inflation_diesel: "Annual diesel price inflation",
  entretien_alternative: "Zero-emission vehicle maintenance cost (factor)",
  consommation_alternative: "Zero-emission vehicle consumption (factor)",
  valeur_residuelle_alternative: "Zero-emission vehicle depreciation (factor)",
  majoration_hivernale: "Annualized winter surcharge (BEV/FCEV)",
  taux_actualisation: "Nominal discount rate",
  prix_h2: "Delivered hydrogen price ($/kg)",
};

export function descriptionHypothese(id: string, langue: Langue): string {
  const h = LISTE_HYPOTHESES.find((x) => x.id === id);
  if (!h) return id;
  return langue === "en" ? HYPOTHESES_EN[id] : h.description;
}

export function nomProgramme(id: string, langue: Langue): string {
  const p = PROGRAMMES.find((x) => x.id === id);
  if (!p) return id;
  return langue === "en" ? PROGRAMMES_EN[id].nom : p.nom;
}

export function cumulProgramme(id: string, langue: Langue): string {
  const p = PROGRAMMES.find((x) => x.id === id);
  if (!p) return "";
  return langue === "en" ? PROGRAMMES_EN[id].cumul : p.cumul;
}

/** Remplace, dans un libellé, le nom français d'un programme par son nom anglais. */
function remplacerNomsProgrammes(texte: string): string {
  let t = texte;
  for (const p of PROGRAMMES) {
    t = t.split(p.nom).join(PROGRAMMES_EN[p.id].nom);
  }
  // Noms COURTS (avant « — ») : libellés des subventions confirmées par le client.
  for (const p of PROGRAMMES) {
    t = t.split(p.nom.split("—")[0].trim()).join(PROGRAMMES_EN[p.id].nom.split("—")[0].trim());
  }
  return t;
}

const MOTIFS: { re: RegExp; en: (m: RegExpMatchArray) => string }[] = [
  {
    re: /^(.*) : classe de poids \(PNBV\) du véhicule inconnue — barème le plus bas des classes possibles retenu par prudence \((.*) \$\)\. Renseignez la classe de poids pour obtenir le barème exact\.$/,
    en: (m) =>
      `${m[1]}: vehicle weight class (GVWR) unknown — lowest scale among possible classes used as a precaution ($${m[2].replace(/\s/g, ",")}). Enter the weight class to get the exact scale.`,
  },
  {
    re: /^(.*) : le pourcentage du coût d'achat appliqué \((\d+) %, borne basse prudente\) est À VALIDER — la cellule correspondante du tableau officiel est vide\.$/,
    en: (m) =>
      `${m[1]}: the purchase-cost percentage applied (${m[2]}%, conservative lower bound) is TO VALIDATE — the corresponding cell of the official table is empty.`,
  },
  {
    re: /^PAVÉ : barème dégressif/,
    en: () =>
      "EVAP: declining scale — the amount depends on the date the dealer submits the application, not the purchase date; limit of 10 incentives per organization (municipalities included) over the program's lifetime.",
  },
  {
    re: /^Écocamionnage : inscription au Registre/,
    en: () =>
      "Écocamionnage: registration in the heavy vehicle owners and operators register (RPEVL) with a satisfactory safety rating required (except class 2b vans); cap of $3M of aid per applicant per fiscal year for acquisitions.",
  },
  {
    re: /^(.*) : aide réduite de (.*) \$ pour respecter le plafond de cumul des aides publiques \((\d+) % des dépenses admissibles, art\. 7\.14\.2\)\.$/,
    en: (m) =>
      `${m[1]}: aid reduced by $${m[2].replace(/\s/g, ",")} to respect the public-aid stacking cap (${m[3]}% of eligible expenses, art. 7.14.2).`,
  },
  {
    re: /^(.*) : année d'acquisition \((\d+)\) hors de l'horizon H=(\d+) — véhicule sans effet sur le plan$/,
    en: (m) => `${m[1]}: acquisition year (${m[2]}) outside the horizon H=${m[3]} — vehicle has no effect on the plan`,
  },
  {
    re: /^(.*) : subvention « (.*) » versée après l'horizon \(année (\d+)\) — ignorée$/,
    en: (m) => `${m[1]}: subsidy “${m[2]}” paid after the horizon (year ${m[3]}) — ignored`,
  },
  {
    re: /^site (.*) : mise en service \((\d+)\) hors de l'horizon H=(\d+) — site sans effet sur le plan$/,
    en: (m) => `site ${m[1]}: commissioning (${m[2]}) outside the horizon H=${m[3]} — site has no effect on the plan`,
  },
  {
    re: /^site (.*) : subvention « (.*) » après l'horizon — ignorée$/,
    en: (m) => `site ${m[1]}: subsidy “${m[2]}” after the horizon — ignored`,
  },
  {
    re: /^site (.*) : technologies mixtes — répartition en parts égales$/,
    en: (m) => `site ${m[1]}: mixed technologies — split in equal shares`,
  },
];

/** Avertissement du moteur/résolveur dans la langue du rapport. Un
 *  message non reconnu est rendu tel quel (jamais supprimé). */
export function traduireAvertissement(texte: string, langue: Langue): string {
  if (langue === "fr") return texte;
  for (const { re, en } of MOTIFS) {
    const m = texte.match(re);
    if (m) return remplacerNomsProgrammes(en(m));
  }
  return remplacerNomsProgrammes(texte);
}

/** Libellé de subvention (« PAVÉ — … », « X — confirmée par le client (réf. Y) »). */
export function traduireLibelleSubvention(libelle: string, langue: Langue): string {
  if (langue === "fr") return libelle;
  return remplacerNomsProgrammes(libelle).replace(/ — confirmée par le client \(réf\. (.*)\)$/, " — confirmed by the client (ref. $1)");
}

const DONNEES_CLIENT_EN: Record<string, string> = {
  "prix du diesel payé ($/L avant TPS/TVQ)": "diesel price paid ($/L before GST/QST)",
  "coût effectif de l’électricité ($/kWh avant taxes)": "effective electricity cost ($/kWh before taxes)",
  "prix de l’hydrogène livré ($/kg avant taxes)": "delivered hydrogen price ($/kg before taxes)",
  "devis de raccordement du dépôt ($ avant taxes)": "depot grid-connection quote ($ before taxes)",
};

/** « X : donnée client (projet, AAAA-MM-JJ) » dans la langue du rapport. */
export function traduireDonneeClient(texte: string, langue: Langue): string {
  if (langue === "fr") return texte;
  const m = texte.match(/^(.*) : donnée client \((projet|organisation)(?:, (\d{4}-\d{2}-\d{2}))?\)$/);
  if (!m) return texte;
  const niveau = m[2] === "projet" ? "project" : "organization";
  return `${DONNEES_CLIENT_EN[m[1]] ?? m[1]}: client data (${niveau}${m[3] ? `, ${m[3]}` : ""})`;
}

/** Nom court (avant « — ») d'un programme du registre, dans la langue voulue. */
export function nomCourtProgramme(id: string, langue: Langue): string {
  return nomProgramme(id, langue).split("—")[0].trim();
}
