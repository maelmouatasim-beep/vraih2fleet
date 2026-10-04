/**
 * Étape 6 du parcours — Rapports : construction PURE des données
 * d'export. Le classeur Excel est décrit en lignes (aoa) testables ;
 * la conversion en fichier .xlsx (SheetJS) se fait dans le composant.
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

export type Cellule = string | number | null;

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
    colonnesService: ["Service", "Véhicules", "Zéro émission", "CO2e évité au pot (t)", "CO2e évité, cycle complet (t)", "VAN des véhicules ($)"],
    colonnesSecteur: ["Secteur (garage)", "Véhicules", "Zéro émission", "CO2e évité au pot (t)", "CO2e évité, cycle complet (t)", "VAN des véhicules ($)", "Infrastructure du secteur ($)"],
    nonRenseigne: "Non renseigné",
    partTransport: "Part du CO2e évité au pot portée par le transport collectif (service utilisé directement par la population)",
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
    colonnesService: ["Department", "Vehicles", "Zero-emission", "Tailpipe CO2e avoided (t)", "Full-cycle CO2e avoided (t)", "Vehicles NPV ($)"],
    colonnesSecteur: ["Sector (depot)", "Vehicles", "Zero-emission", "Tailpipe CO2e avoided (t)", "Full-cycle CO2e avoided (t)", "Vehicles NPV ($)", "Sector infrastructure ($)"],
    nonRenseigne: "Not specified",
    partTransport: "Share of tailpipe CO2e avoided carried by public transit (a service residents use directly)",
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
          c.technologie,
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
    colonnesHyp: ["Identifiant", "Description", "Valeur", "Unité", "Statut", "Source", "Année", "Vérifiée le"],
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
    colonnesHyp: ["Identifier", "Description", "Value", "Unit", "Status", "Source", "Year", "Checked on"],
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

  const budget: Cellule[][] = [
    [l.titre(meta.projet, meta.organisation)],
    [l.genere(meta.dateIso, ENGINE_VERSION, resultat.empreinteEntree)],
    [l.strategie(libelleStrategieRetenue(meta.strategieRetenue ?? { cle: null, ecarts: 0 }, langue))],
    [l.note],
    [],
    l.colonnesBudget,
    ...resultat.vueBudgetaire.map((l) => [
      l.annee,
      l.investissementAlt,
      l.subventionsAlt,
      l.resteAFinancerAlt,
      l.fonctionnementAlt,
      l.residuelsAlt,
      l.netAlt,
      l.netRef,
      l.ecart,
    ]),
    [],
    [l.tcoPlan, resultat.alternative.tcoActualise],
    [l.tcoSq, resultat.reference.tcoActualise],
    [l.van, resultat.vanDifferentielle],
    [l.invBrut, investissementCompare(resultat).brut],
    [l.invSq, investissementCompare(resultat).statuQuo],
    [l.invEcart, investissementCompare(resultat).surcout],
    [l.co2Ttw, resultat.co2EviteTtwTonnes],
    [l.co2, resultat.co2EviteWtwTonnes],
    [
      l.payback,
      resultat.paybackActualise.annees ?? texteRecuperation(resultat.paybackActualise, resultat.horizonAns, langue === "en"),
    ],
    [],
    [l.titreDecomposition],
    [l.colonnesDecomposition[0], l.colonnesDecomposition[1]],
    ...POSTES_VAN.map((p): Cellule[] => [LIBELLES_POSTES[langue][p], resultat.decompositionVan[p]]),
    [l.totalDecomposition, resultat.vanDifferentielle],
  ];

  const vehicules: Cellule[][] = [
    l.colonnesVehicules,
    ...plan.vehicules.map((v) => {
      const subventions = v.subventionsAlternative ?? [];
      return [
        unites.get(v.id) ?? v.id,
        v.alternative.technologie,
        meta.anneeReference + (v.anneeAcquisition ?? 0),
        v.kmParAn,
        v.dureeVieAns,
        v.reference.prixAvantTaxes,
        v.alternative.prixAvantTaxes,
        subventions
          .map((s) => `${traduireLibelleSubvention(s.libelle, langue)} : ${s.montant} $ (${l.an} ${s.annee})`)
          .join(" ; ") || "—",
        subventions.reduce((a, s) => a + s.montant, 0),
        (strategie.explicationsSubventions[v.id] ?? []).map((e) => texteExplication(e, langue)).join(" ; ") || "—",
      ];
    }),
    [],
    l.sites,
    // MÊME plan par garage que Stratégies, Plan, Financement et PDF.
    ...strategie.infra.garages.map((g): Cellule[] => [
      g.depot ?? l.sansGarage,
      g.capexBornes,
      g.raccordement.kwDemandes,
      g.raccordement.kwDisponiblesSource === "presumee"
        ? `${g.raccordement.kwDisponibles} (${l.presume})`
        : g.raccordement.kwDisponibles,
      g.raccordement.palier,
      g.raccordement.cout,
      g.capexStationH2,
      g.capexTotal,
    ]),
    [l.totalInfra, null, null, null, null, null, null, strategie.infra.totalCapex],
  ];

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
      h.id === "taux_actualisation_nominal" ? meta.tauxActualisationNominal : h.valeur,
      h.unite,
      h.id === "taux_actualisation_nominal"
        ? l.parametreProjet
        : (l.statuts[h.statut] ?? h.statut),
      `${h.source.organisme} — ${h.source.document}`,
      h.source.annee,
      h.dateVerification,
    ]),
  ];

  return [
    { nom: l.feuilles[0], lignes: budget },
    { nom: l.feuilles[1], lignes: vehicules },
    ...(meta.fmv ? [feuilleFondsMunicipalVert(meta.fmv, unites, langue)] : []),
    { nom: l.feuilles[2], lignes: hypotheses },
  ];
}
