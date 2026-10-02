/**
 * Étape 6 du parcours — Rapports : construction PURE des données
 * d'export. Le classeur Excel est décrit en lignes (aoa) testables ;
 * la conversion en fichier .xlsx (SheetJS) se fait dans le composant.
 * Tout vient du moteur (ResultatPlan) et du registre d'hypothèses —
 * aucune valeur recalculée à la main ici.
 */
import { ENGINE_VERSION, LISTE_HYPOTHESES, type ResultatPlan } from "@/lib/tco";
import {
  descriptionHypothese,
  traduireDonneeClient,
  traduireLibelleSubvention,
  type Langue,
} from "@/lib/tco/translations-en";
import { libelleStrategieRetenue, type StrategieConstruite, type StrategieRetenue } from "./strategies";
import { texteRecuperation } from "./payback";
import { texteExplication } from "./subsidy-explain";

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
    co2Ttw: "CO2e évité — au pot d'échappement, réservoir à la roue (t)",
    payback: "Délai de récupération actualisé (ans)",
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
    co2Ttw: "CO2e avoided — tailpipe, tank-to-wheel (t)",
    payback: "Discounted payback (years)",
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
    [l.co2Ttw, resultat.co2EviteTtwTonnes],
    [l.co2, resultat.co2EviteWtwTonnes],
    [
      l.payback,
      resultat.paybackActualise.annees ?? texteRecuperation(resultat.paybackActualise, resultat.horizonAns, langue === "en"),
    ],
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
    { nom: l.feuilles[2], lignes: hypotheses },
  ];
}
