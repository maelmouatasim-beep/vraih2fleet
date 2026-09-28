/**
 * Étape 6 du parcours — Rapports : construction PURE des données
 * d'export. Le classeur Excel est décrit en lignes (aoa) testables ;
 * la conversion en fichier .xlsx (SheetJS) se fait dans le composant.
 * Tout vient du moteur (ResultatPlan) et du registre d'hypothèses —
 * aucune valeur recalculée à la main ici.
 */
import { ENGINE_VERSION, LISTE_HYPOTHESES, type ResultatPlan } from "@/lib/tco";
import type { StrategieConstruite } from "./strategies";

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
}

const STATUTS_FR: Record<string, string> = {
  verifie: "vérifié",
  estimation: "estimation",
  a_valider: "à valider",
};

/** Classeur du plan : budget annuel, véhicules/subventions, hypothèses. */
export function construireClasseurPlan(
  strategie: StrategieConstruite,
  unites: Map<string, string>,
  meta: MetaRapport,
): FeuilleClasseur[] {
  const resultat = strategie.resultat as ResultatPlan;
  const plan = strategie.plan!;

  const budget: Cellule[][] = [
    [`Plan de remplacement — ${meta.projet} (${meta.organisation})`],
    [
      `Généré le ${meta.dateIso} — moteur H2Fleet ${ENGINE_VERSION} — empreinte ${resultat.empreinteEntree}`,
    ],
    ["Dollars courants (vue budgétaire). Écart positif = le plan coûte moins cher que le statu quo."],
    [],
    [
      "Année",
      "Investissement (PTI)",
      "Subventions",
      "Reste à financer",
      "Fonctionnement",
      "Valeurs résiduelles",
      "Net plan",
      "Net statu quo",
      "Écart",
    ],
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
    ["TCO actualisé du plan", resultat.alternative.tcoActualise],
    ["TCO actualisé du statu quo", resultat.reference.tcoActualise],
    ["Économie (VAN)", resultat.vanDifferentielle],
    ["CO2e évité (puits à la roue, t)", resultat.co2EviteWtwTonnes],
    [
      "Délai de récupération actualisé (ans)",
      resultat.paybackActualise.annees ?? resultat.paybackActualise.raison,
    ],
  ];

  const vehicules: Cellule[][] = [
    [
      "Unité",
      "Technologie cible",
      "Année d'achat",
      "km/an retenus",
      "Durée de vie (ans)",
      "Prix avant taxes (réf. diesel)",
      "Prix avant taxes (cible)",
      "Subventions retenues",
      "Total subventions",
    ],
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
        subventions.map((s) => `${s.libelle} : ${s.montant} $ (an ${s.annee})`).join(" ; ") || "—",
        subventions.reduce((a, s) => a + s.montant, 0),
      ];
    }),
    [],
    ["Sites d'infrastructure", "Capex avant taxes"],
    ...(plan.sitesInfra ?? []).map((s) => [s.id, s.capexAvantTaxes]),
  ];

  const hypotheses: Cellule[][] = [
    ["Hypothèses du registre (docs/tco-methodologie.md §8 — statuts honnêtes)"],
    [],
    ["Identifiant", "Description", "Valeur", "Unité", "Statut", "Source", "Année", "Vérifiée le"],
    ...LISTE_HYPOTHESES.map((h) => [
      h.id,
      h.description,
      h.valeur,
      h.unite,
      STATUTS_FR[h.statut] ?? h.statut,
      `${h.source.organisme} — ${h.source.document}`,
      h.source.annee,
      h.dateVerification,
    ]),
  ];

  return [
    { nom: "Plan annuel", lignes: budget },
    { nom: "Véhicules", lignes: vehicules },
    { nom: "Hypothèses", lignes: hypotheses },
  ];
}
