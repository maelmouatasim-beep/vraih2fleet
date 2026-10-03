/**
 * Phase 5.7 — NOTE AU CONSEIL : module PUR (testé).
 *
 * 1. `faitsNote` : les FAITS du plan, calculés par le moteur (VAN, coûts,
 *    subventions, budget, stress test, hiver, émissions…), chacun avec
 *    un identifiant, un libellé, sa valeur brute, son rendu fr/en et sa
 *    source. Ce sont les SEULS nombres qu'une note peut contenir.
 * 2. `brouillonModele` : rédaction SANS IA (gabarits fr/en à jetons
 *    {{fait}}), adaptée au résultat (économie ou surcoût, robustesse au
 *    stress test, hiver).
 * 3. `rendreSections` : remplacement des jetons par les valeurs du moteur
 *    (brouillon IA ou modèle).
 * 4. `verifierNote` : après édition par l'utilisateur, chaque nombre du
 *    texte doit correspondre à un fait (règle Phase 5) ; sinon l'export est
 *    bloqué et les nombres en cause sont listés.
 */
import { ENGINE_VERSION, LISTE_HYPOTHESES, type ResultatSensibilite } from "@/lib/tco";
import { PARAMETRES_STRESS_EN, nomCourtProgramme } from "@/lib/tco/translations-en";
import { verifierNombres } from "../../../supabase/functions/_shared/numberCheck";
import {
  SECTIONS_NOTE,
  type FaitTransmis,
  type SectionNote,
  type SectionsNote,
} from "../../../supabase/functions/_shared/councilNote";
import { texteRecuperation } from "./payback";
import { libelleStrategieRetenue, type StrategieConstruite, type StrategieRetenue } from "./strategies";
import type { DiagnosticHiver } from "./winter";

export { SECTIONS_NOTE, type SectionNote, type SectionsNote };
export type Langue = "fr" | "en";
type Bilingue = { fr: string; en: string };

export interface FaitNote {
  id: string;
  libelle: Bilingue;
  /** Valeur brute (nombre du moteur, ou texte). */
  valeur: number | string;
  rendu: Bilingue;
  source: Bilingue;
}

export interface EntreeFaits {
  organisation: string;
  projet: string;
  dateIso: string;
  anneeReference: number;
  horizonAns: number;
  tauxActualisationNominal: number;
  strategie: StrategieConstruite;
  retenue: StrategieRetenue;
  sensibilite: ResultatSensibilite;
  /** Diagnostics hiver des véhicules électriques à batterie du plan. */
  hiver: (DiagnosticHiver | null)[];
}

const cad = (l: Langue) =>
  new Intl.NumberFormat(l === "en" ? "en-CA" : "fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const nombre = (l: Langue, d = 0) =>
  new Intl.NumberFormat(l === "en" ? "en-CA" : "fr-CA", { maximumFractionDigits: d, minimumFractionDigits: d });

const MOTEUR: Bilingue = { fr: `moteur H2Fleet ${ENGINE_VERSION}`, en: `H2Fleet engine ${ENGINE_VERSION}` };
const REGISTRE: Bilingue = { fr: "registre des hypothèses", en: "assumption registry" };
const PROJET: Bilingue = { fr: "données du projet", en: "project data" };

/** Faits du plan, dans un ordre stable. Aucun calcul de TCO ici : tout
 *  vient du résultat du moteur et du stress test (qui relance le moteur). */
export function faitsNote(e: EntreeFaits): FaitNote[] {
  const s = e.strategie;
  const r = s.resultat;
  const plan = s.plan;
  if (!r || !plan) return [];
  const faits: FaitNote[] = [];
  const ajouter = (id: string, libelle: Bilingue, valeur: number | string, rendu: Bilingue, source: Bilingue) =>
    faits.push({ id, libelle, valeur, rendu, source });
  const montant = (id: string, libelle: Bilingue, v: number, source = MOTEUR) =>
    ajouter(id, libelle, v, { fr: cad("fr").format(v), en: cad("en").format(v) }, source);
  const compte = (id: string, libelle: Bilingue, v: number, source = MOTEUR) =>
    ajouter(id, libelle, v, { fr: nombre("fr").format(v), en: nombre("en").format(v) }, source);
  const annee = (id: string, libelle: Bilingue, v: number, source = MOTEUR) =>
    ajouter(id, libelle, v, { fr: String(v), en: String(v) }, source);
  const texte = (id: string, libelle: Bilingue, rendu: Bilingue, source = PROJET) => ajouter(id, libelle, rendu.fr, rendu, source);

  texte("organisation", { fr: "Organisation", en: "Organization" }, { fr: e.organisation, en: e.organisation });
  texte("projet", { fr: "Projet", en: "Project" }, { fr: e.projet, en: e.projet });
  ajouter("date_note", { fr: "Date de la note", en: "Note date" }, e.dateIso, { fr: e.dateIso, en: e.dateIso }, PROJET);
  texte(
    "strategie_retenue",
    { fr: "Stratégie retenue", en: "Selected strategy" },
    { fr: libelleStrategieRetenue(e.retenue, "fr"), en: libelleStrategieRetenue(e.retenue, "en") },
  );
  ajouter(
    "horizon_ans",
    { fr: "Horizon d'analyse", en: "Analysis horizon" },
    e.horizonAns,
    { fr: `${e.horizonAns} ans`, en: `${e.horizonAns} years` },
    PROJET,
  );
  annee("annee_reference", { fr: "Année de référence", en: "Reference year" }, e.anneeReference, PROJET);
  annee("annee_fin", { fr: "Dernière année de l'horizon", en: "Last year of the horizon" }, e.anneeReference + e.horizonAns - 1, PROJET);
  ajouter(
    "taux_actualisation",
    { fr: "Taux d'actualisation nominal", en: "Nominal discount rate" },
    e.tauxActualisationNominal,
    {
      fr: `${nombre("fr", 1).format(e.tauxActualisationNominal * 100)} %`,
      en: `${nombre("en", 1).format(e.tauxActualisationNominal * 100)}%`,
    },
    PROJET,
  );
  compte("nb_vehicules", { fr: "Véhicules du plan", en: "Vehicles in the plan" }, s.nbVehicules, PROJET);
  compte("nb_ze", { fr: "Véhicules zéro émission", en: "Zero-emission vehicles" }, s.nbZeroEmission, PROJET);
  const part = s.nbVehicules > 0 ? Math.round((s.nbZeroEmission / s.nbVehicules) * 100) : 0;
  ajouter("part_ze", { fr: "Part zéro émission", en: "Zero-emission share" }, part, { fr: `${part} %`, en: `${part}%` }, PROJET);
  const achats = plan.vehicules
    .filter((v) => v.alternative.technologie !== "diesel")
    .map((v) => e.anneeReference + (v.anneeAcquisition ?? 0))
    .sort((a, b) => a - b);
  if (achats.length > 0) {
    annee("premiere_annee_achat", { fr: "Premier achat zéro émission", en: "First zero-emission purchase" }, achats[0], PROJET);
    annee("derniere_annee_achat", { fr: "Dernier achat zéro émission", en: "Last zero-emission purchase" }, achats[achats.length - 1], PROJET);
    compte(
      "nb_achats_premiere_annee",
      { fr: "Achats la première année", en: "Purchases in the first year" },
      achats.filter((a) => a === achats[0]).length,
      PROJET,
    );
  }

  // Coûts et bénéfices (moteur)
  const van = r.vanDifferentielle;
  montant("van_centrale", { fr: "Économie actualisée vs statu quo (VAN)", en: "Discounted savings vs status quo (NPV)" }, van);
  montant("ecart_central_abs", { fr: "Écart actualisé (valeur absolue)", en: "Discounted gap (absolute value)" }, Math.abs(van));
  montant("tco_plan", { fr: "Coût total actualisé du plan", en: "Discounted total cost of the plan" }, r.alternative.tcoActualise);
  montant("tco_statu_quo", { fr: "Coût total actualisé du statu quo", en: "Discounted total cost of the status quo" }, r.reference.tcoActualise);
  texte(
    "recuperation",
    { fr: "Récupération actualisée", en: "Discounted payback" },
    { fr: texteRecuperation(r.paybackActualise, r.horizonAns, false), en: texteRecuperation(r.paybackActualise, r.horizonAns, true) },
    MOTEUR,
  );
  const tonnes = (id: string, libelle: Bilingue, v: number) =>
    ajouter(id, libelle, v, { fr: `${nombre("fr").format(v)} t`, en: `${nombre("en").format(v)} t` }, MOTEUR);
  tonnes("co2_evite_t", { fr: "CO2e évité, cycle complet", en: "CO2e avoided, full cycle" }, Math.round(r.co2EviteWtwTonnes));
  tonnes("co2_evite_pot_t", { fr: "CO2e évité au pot d'échappement", en: "CO2e avoided at the tailpipe" }, Math.round(r.co2EviteTtwTonnes));
  if (r.coutParTonneWtw != null) {
    // Coût négatif = le plan économise de l'argent en évitant des tonnes.
    if (r.coutParTonneWtw < 0) {
      montant("economie_par_tonne", { fr: "Économie par tonne évitée", en: "Savings per tonne avoided" }, -r.coutParTonneWtw);
    } else {
      montant("cout_par_tonne", { fr: "Coût par tonne évitée", en: "Cost per tonne avoided" }, r.coutParTonneWtw);
    }
  }

  // Financement (vue budgétaire du moteur, dollars courants)
  const budget = r.vueBudgetaire;
  const investissement = budget.reduce((a, l) => a + l.investissementAlt, 0);
  const reste = budget.reduce((a, l) => a + l.resteAFinancerAlt, 0);
  montant("investissement_total", { fr: "Investissement total (dollars courants)", en: "Total investment (current dollars)" }, investissement);
  montant("subventions_total", { fr: "Subventions prévues", en: "Expected subsidies" }, s.subventionsTotal);
  montant("reste_a_financer", { fr: "Reste à financer", en: "Amount to finance" }, reste);
  montant("infra_total", { fr: "Infrastructure de recharge et raccordement", en: "Charging infrastructure and grid connection" }, s.infra.totalCapex);
  const pointe = budget.reduce((m, l) => (l.investissementAlt > m.investissementAlt ? l : m), budget[0]);
  if (pointe && pointe.investissementAlt > 0) {
    annee("annee_pointe", { fr: "Année de pointe d'investissement", en: "Peak investment year" }, pointe.annee);
    montant("investissement_pointe", { fr: "Investissement de l'année de pointe", en: "Peak-year investment" }, pointe.investissementAlt);
  }
  const programmes = new Map<string, number>();
  for (const liste of Object.values(s.explicationsSubventions)) {
    for (const ex of liste) if (ex.montant > 0) programmes.set(ex.programmeId, (programmes.get(ex.programmeId) ?? 0) + ex.montant);
  }
  const listeProgrammes = (l: Langue) =>
    [...programmes].map(([id, m]) => `${nomCourtProgramme(id, l)} (${cad(l).format(m)})`).join(l === "fr" ? " ; " : "; ");
  if (programmes.size > 0) {
    texte("programmes_retenus", { fr: "Programmes retenus", en: "Programs counted" }, { fr: listeProgrammes("fr"), en: listeProgrammes("en") }, MOTEUR);
  }
  compte("nb_programmes", { fr: "Programmes de subvention retenus", en: "Subsidy programs counted" }, programmes.size);

  // Stress test (relance le moteur aux bornes sourcées du registre)
  const sc = e.sensibilite.scenarios;
  montant("van_prudente", { fr: "VAN, scénario prudent", en: "NPV, cautious scenario" }, sc.prudent.van);
  montant("van_favorable", { fr: "VAN, scénario favorable", en: "NPV, favourable scenario" }, sc.favorable.van);
  compte(
    "scenarios_gagnants",
    { fr: "Scénarios où le plan reste gagnant", en: "Scenarios in which the plan still wins" },
    [sc.prudent.van, sc.central.van, sc.favorable.van].filter((v) => v > 0).length,
  );
  compte("nb_scenarios", { fr: "Scénarios du stress test", en: "Stress-test scenarios" }, 3);
  const risque = e.sensibilite.niveauRisque;
  texte(
    "niveau_risque",
    { fr: "Niveau de risque", en: "Risk level" },
    { fr: { faible: "faible", moyen: "moyen", eleve: "élevé" }[risque], en: { faible: "low", moyen: "medium", eleve: "high" }[risque] },
    MOTEUR,
  );
  const facteurs = (l: Langue) =>
    e.sensibilite.tornade
      .slice(0, 3)
      .map((b) => (l === "en" ? (PARAMETRES_STRESS_EN[b.id] ?? b.libelle) : b.libelle))
      .join(l === "fr" ? " ; " : "; ");
  if (e.sensibilite.tornade.length > 0) {
    texte("facteurs_influents", { fr: "Facteurs les plus influents", en: "Most influential factors" }, { fr: facteurs("fr"), en: facteurs("en") }, MOTEUR);
  }
  const aValider = LISTE_HYPOTHESES.filter((h) => h.statut === "a_valider").length;
  const estimations = LISTE_HYPOTHESES.filter((h) => h.statut === "estimation").length;
  compte("hypotheses_a_valider", { fr: "Hypothèses à valider", en: "Assumptions to validate" }, aValider, REGISTRE);
  compte("hypotheses_estimations", { fr: "Hypothèses estimées", en: "Estimated assumptions" }, estimations, REGISTRE);
  compte("hypotheses_total", { fr: "Hypothèses du registre", en: "Registry assumptions" }, LISTE_HYPOTHESES.length, REGISTRE);

  // Hiver (diagnostic des véhicules électriques à batterie)
  const diag = e.hiver.filter((d): d is DiagnosticHiver => !!d);
  compte("nb_bev", { fr: "Véhicules électriques à batterie", en: "Battery-electric vehicles" }, diag.length, PROJET);
  compte("hiver_tient", { fr: "BEV qui tiennent l'hiver", en: "BEVs that hold up in winter" }, diag.filter((d) => d.verdict === "tient").length);
  compte(
    "hiver_recharge_journee",
    { fr: "BEV avec recharge en journée", en: "BEVs needing daytime charging" },
    diag.filter((d) => d.verdict === "recharge_journee").length,
  );
  compte("hiver_ne_tient_pas", { fr: "BEV qui ne tiennent pas l'hiver", en: "BEVs that do not hold up in winter" }, diag.filter((d) => d.verdict === "ne_tient_pas").length);
  compte(
    "garages_depasses",
    { fr: "Garages dont la capacité électrique est dépassée", en: "Garages whose electrical capacity is exceeded" },
    s.infra.garages.filter((g) => g.raccordement.kwSupplementaires > 0).length,
  );

  ajouter("moteur_version", { fr: "Version du moteur", en: "Engine version" }, ENGINE_VERSION, { fr: ENGINE_VERSION, en: ENGINE_VERSION }, MOTEUR);
  ajouter("empreinte", { fr: "Empreinte des entrées", en: "Input fingerprint" }, r.empreinteEntree, { fr: r.empreinteEntree, en: r.empreinteEntree }, MOTEUR);
  return faits;
}

/** Faits transmis à l'IA (rendu dans la langue de la note). */
export function faitsTransmis(faits: FaitNote[], langue: Langue): FaitTransmis[] {
  return faits.map((f) => ({ id: f.id, libelle: f.libelle[langue], valeur: f.rendu[langue] }));
}

const JETON = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

export function rendreTexte(gabarit: string, faits: FaitNote[], langue: Langue): string {
  const parId = new Map(faits.map((f) => [f.id, f.rendu[langue]]));
  return gabarit.replace(JETON, (m, id: string) => parId.get(id) ?? m);
}

export function rendreSections(gabarits: SectionsNote, faits: FaitNote[], langue: Langue): SectionsNote {
  return Object.fromEntries(SECTIONS_NOTE.map((s) => [s, rendreTexte(gabarits[s] ?? "", faits, langue)])) as SectionsNote;
}

export interface VerificationNote {
  ok: boolean;
  /** Nombres introuvables parmi les faits, par section. */
  nonVerifies: { section: SectionNote; nombres: string[] }[];
  /** Jetons restés sans valeur. */
  jetonsRestants: string[];
}

/** Chaque nombre du texte (édité) doit correspondre à un fait du moteur. */
export function verifierNote(sections: SectionsNote, faits: FaitNote[], langue: Langue): VerificationNote {
  const corpus = faits.flatMap((f) => [f.valeur, f.rendu.fr, f.rendu.en]);
  const nonVerifies: VerificationNote["nonVerifies"] = [];
  const jetonsRestants: string[] = [];
  for (const s of SECTIONS_NOTE) {
    const texte = sections[s] ?? "";
    for (const m of texte.matchAll(JETON)) jetonsRestants.push(m[0]);
    const r = verifierNombres(texte.replace(JETON, " "), langue, corpus);
    if (!r.ok) nonVerifies.push({ section: s, nombres: r.nonVerifies });
  }
  return { ok: nonVerifies.length === 0 && jetonsRestants.length === 0, nonVerifies, jetonsRestants };
}

/** Rédaction SANS IA : gabarits à jetons, adaptés au résultat du moteur. */
export function brouillonModele(faits: FaitNote[], langue: Langue): SectionsNote {
  const v = (id: string) => faits.find((f) => f.id === id)?.valeur;
  const a = (id: string) => faits.some((f) => f.id === id);
  const van = Number(v("van_centrale") ?? 0);
  const gagnants = Number(v("scenarios_gagnants") ?? 0);
  const nbZe = Number(v("nb_ze") ?? 0);
  const bev = Number(v("nb_bev") ?? 0);
  const neTient = Number(v("hiver_ne_tient_pas") ?? 0);
  const recharge = Number(v("hiver_recharge_journee") ?? 0);
  const garages = Number(v("garages_depasses") ?? 0);
  const subventions = Number(v("subventions_total") ?? 0);
  const fr = langue === "fr";

  const recommandation =
    van > 0 && gagnants === 3
      ? fr
        ? "Il est recommandé que le conseil adopte le plan de remplacement de la flotte (stratégie « {{strategie_retenue}} »). Sur {{horizon_ans}}, il coûte {{van_centrale}} de moins que le statu quo en valeur actualisée, et il reste gagnant dans chacun des {{nb_scenarios}} scénarios du stress test."
        : "Council is asked to adopt the fleet replacement plan (strategy “{{strategie_retenue}}”). Over {{horizon_ans}}, it costs {{van_centrale}} less than the status quo in present value, and it still comes out ahead in each of the {{nb_scenarios}} stress-test scenarios."
      : van > 0
        ? fr
          ? "Il est recommandé que le conseil adopte le plan de remplacement de la flotte (stratégie « {{strategie_retenue}} »), sous réserve de valider d'ici le premier achat les hypothèses les plus influentes. Dans le scénario central, il économise {{van_centrale}} en valeur actualisée sur {{horizon_ans}} ; il reste gagnant dans {{scenarios_gagnants}} des {{nb_scenarios}} scénarios du stress test."
          : "Council is asked to adopt the fleet replacement plan (strategy “{{strategie_retenue}}”), subject to validating the most influential assumptions before the first purchase. In the central scenario it saves {{van_centrale}} in present value over {{horizon_ans}}; it comes out ahead in {{scenarios_gagnants}} of the {{nb_scenarios}} stress-test scenarios."
        : fr
          ? "Il est recommandé de ne pas adopter le plan tel quel et d'en demander la révision. Dans le scénario central, il coûte {{ecart_central_abs}} de plus que le statu quo en valeur actualisée sur {{horizon_ans}} ; il n'est gagnant que dans {{scenarios_gagnants}} des {{nb_scenarios}} scénarios du stress test."
          : "Council is asked not to adopt the plan as it stands and to request a revision. In the central scenario it costs {{ecart_central_abs}} more than the status quo in present value over {{horizon_ans}}; it comes out ahead in only {{scenarios_gagnants}} of the {{nb_scenarios}} stress-test scenarios.";

  const contexte = fr
    ? `${nbZe > 0 ? `Le plan fait passer {{nb_ze}} des {{nb_vehicules}} véhicules au zéro émission${a("derniere_annee_achat") ? " d'ici {{derniere_annee_achat}}" : ""}` : "Le plan ne prévoit aucun véhicule zéro émission"}. Le périmètre du projet « {{projet}} » de {{organisation}} compte {{nb_vehicules}} véhicules ; les remplacements zéro émission représentent {{part_ze}} de la flotte du plan${a("premiere_annee_achat") ? " et s'échelonnent de {{premiere_annee_achat}} à {{derniere_annee_achat}}" : ""}. L'analyse couvre {{horizon_ans}} à partir de {{annee_reference}} et compare chaque remplacement à un véhicule neuf équivalent à combustion, au même calendrier.`
    : `${nbZe > 0 ? `The plan moves {{nb_ze}} of {{nb_vehicules}} vehicles to zero emission${a("derniere_annee_achat") ? " by {{derniere_annee_achat}}" : ""}` : "The plan includes no zero-emission vehicle"}. The scope of {{organisation}}'s “{{projet}}” project covers {{nb_vehicules}} vehicles; zero-emission replacements account for {{part_ze}} of the plan's fleet${a("premiere_annee_achat") ? " and are spread from {{premiere_annee_achat}} to {{derniere_annee_achat}}" : ""}. The analysis covers {{horizon_ans}} from {{annee_reference}} and compares each replacement with an equivalent new combustion vehicle on the same schedule.`;

  const couts = fr
    ? `${van > 0 ? "Le plan est moins coûteux que le statu quo" : "Le plan est plus coûteux que le statu quo"} : son coût total actualisé atteint {{tco_plan}}, contre {{tco_statu_quo}} pour le statu quo, soit un écart de {{ecart_central_abs}}. Récupération actualisée : {{recuperation}}. Le plan évite {{co2_evite_t}} de CO2e sur le cycle complet, dont {{co2_evite_pot_t}} au pot d'échappement${a("cout_par_tonne") ? ", pour un coût de {{cout_par_tonne}} par tonne évitée" : a("economie_par_tonne") ? ", tout en économisant {{economie_par_tonne}} par tonne évitée" : ""}.`
    : `${van > 0 ? "The plan costs less than the status quo" : "The plan costs more than the status quo"}: its discounted total cost is {{tco_plan}}, against {{tco_statu_quo}} for the status quo, a gap of {{ecart_central_abs}}. Discounted payback: {{recuperation}}. The plan avoids {{co2_evite_t}} of CO2e over the full cycle, including {{co2_evite_pot_t}} at the tailpipe${a("cout_par_tonne") ? ", at a cost of {{cout_par_tonne}} per tonne avoided" : a("economie_par_tonne") ? ", while saving {{economie_par_tonne}} per tonne avoided" : ""}.`;

  const financement = fr
    ? `L'investissement total s'élève à {{investissement_total}} en dollars courants, dont {{infra_total}} pour la recharge et le raccordement. ${subventions > 0 ? `Les subventions prévues totalisent {{subventions_total}}${a("programmes_retenus") ? " ({{programmes_retenus}})" : ""} ; le reste à financer est de {{reste_a_financer}}.` : "Aucune subvention n'est retenue au plan avec les règles en vigueur ; le reste à financer est donc de {{reste_a_financer}}."}${a("annee_pointe") ? " L'année de pointe est {{annee_pointe}}, avec {{investissement_pointe}} d'investissement." : ""} Aucune subvention n'est acquise avant l'acceptation de la demande.`
    : `Total investment amounts to {{investissement_total}} in current dollars, including {{infra_total}} for charging and grid connection. ${subventions > 0 ? `Expected subsidies total {{subventions_total}}${a("programmes_retenus") ? " ({{programmes_retenus}})" : ""}; the amount to finance is {{reste_a_financer}}.` : "No subsidy is counted in the plan under the rules in force; the amount to finance is therefore {{reste_a_financer}}."}${a("annee_pointe") ? " The peak year is {{annee_pointe}}, with {{investissement_pointe}} of investment." : ""} No subsidy is secured until the application is accepted.`;

  const risques = fr
    ? `${gagnants === 3 ? "Le résultat résiste au stress test" : "Le résultat est sensible aux hypothèses"} : le plan reste gagnant dans {{scenarios_gagnants}} des {{nb_scenarios}} scénarios, avec une VAN de {{van_prudente}} dans le scénario prudent et de {{van_favorable}} dans le scénario favorable (niveau de risque {{niveau_risque}}).${a("facteurs_influents") ? " Les facteurs les plus influents sont : {{facteurs_influents}}." : ""} {{hypotheses_a_valider}} des {{hypotheses_total}} hypothèses du registre restent à valider à la source et {{hypotheses_estimations}} sont des estimations ; elles sont listées en annexe avec leur statut.`
    : `${gagnants === 3 ? "The result holds under the stress test" : "The result is sensitive to the assumptions"}: the plan comes out ahead in {{scenarios_gagnants}} of the {{nb_scenarios}} scenarios, with an NPV of {{van_prudente}} in the cautious scenario and {{van_favorable}} in the favourable one (risk level {{niveau_risque}}).${a("facteurs_influents") ? " The most influential factors are: {{facteurs_influents}}." : ""} {{hypotheses_a_valider}} of the {{hypotheses_total}} registry assumptions still need to be validated at the source and {{hypotheses_estimations}} are estimates; they are listed in the appendix with their status.`;

  const hiver =
    bev === 0
      ? fr
        ? "Le plan ne compte aucun véhicule électrique à batterie : le diagnostic hivernal ne s'applique pas."
        : "The plan includes no battery-electric vehicle: the winter diagnostic does not apply."
      : fr
        ? `${neTient > 0 ? "L'exploitation hivernale demande des ajustements" : recharge > 0 ? "L'exploitation hivernale est assurée avec une recharge en journée pour une partie des véhicules" : "Les véhicules électriques tiennent l'hiver"} : sur {{nb_bev}} véhicules électriques à batterie, {{hiver_tient}} tiennent une journée d'hiver sur la recharge de nuit, {{hiver_recharge_journee}} demandent une recharge en journée et {{hiver_ne_tient_pas}} ne tiennent pas avec le modèle présumé.${garages > 0 ? " La capacité électrique de {{garages_depasses}} garage(s) est dépassée : le raccordement est chiffré dans le plan." : ""}`
        : `${neTient > 0 ? "Winter operation requires adjustments" : recharge > 0 ? "Winter operation is ensured with daytime charging for some vehicles" : "The electric vehicles hold up in winter"}: of {{nb_bev}} battery-electric vehicles, {{hiver_tient}} complete a winter day on overnight charging, {{hiver_recharge_journee}} need daytime charging and {{hiver_ne_tient_pas}} do not hold up with the presumed model.${garages > 0 ? " The electrical capacity of {{garages_depasses}} garage(s) is exceeded: the grid connection is costed in the plan." : ""}`;

  const etapes = fr
    ? [
        "- Adopter la recommandation et autoriser le lancement des appels d'offres pour les premiers achats" + (a("premiere_annee_achat") ? " ({{premiere_annee_achat}}, {{nb_achats_premiere_annee}} véhicule(s))." : "."),
        a("programmes_retenus") ? "- Déposer les demandes de subvention avant l'achat : {{programmes_retenus}}." : "- Vérifier l'admissibilité aux programmes de subvention avant chaque achat.",
        "- Valider à la source les hypothèses les plus influentes et obtenir des devis pour les véhicules, les bornes et le raccordement.",
        "- Mettre à jour le plan et présenter un suivi annuel au conseil (réalisé contre prévu).",
      ].join("\n")
    : [
        "- Adopt the recommendation and authorize tenders for the first purchases" + (a("premiere_annee_achat") ? " ({{premiere_annee_achat}}, {{nb_achats_premiere_annee}} vehicle(s))." : "."),
        a("programmes_retenus") ? "- Submit subsidy applications before purchase: {{programmes_retenus}}." : "- Check subsidy eligibility before each purchase.",
        "- Validate the most influential assumptions at the source and obtain quotes for vehicles, chargers and grid connection.",
        "- Update the plan and report progress to council every year (actual vs planned).",
      ].join("\n");

  return { recommandation, contexte, couts, financement, risques, hiver, prochaines_etapes: etapes };
}
