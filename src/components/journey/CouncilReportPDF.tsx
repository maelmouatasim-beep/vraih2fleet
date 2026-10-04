/**
 * Rapport détaillé « prêt pour le conseil » (fr/en) — généré depuis le
 * RÉSULTAT DU MOTEUR (aucun chiffre recalculé ici), au standard des
 * cabinets de conseil (Phase 5.7, gabarit ./pdf/theme) : synthèse et titre
 * d'action d'abord, chiffres clés, pièces numérotées et sourcées (garages,
 * stress test, budget annuel, véhicules et subventions), points
 * d'attention, annexes (méthodologie, données client, pièces
 * justificatives, hypothèses avec statut et date de vérification).
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { ENGINE_VERSION, LISTE_HYPOTHESES, type ResultatPlan } from "@/lib/tco";
import type { ResultatSensibilite } from "@/lib/tco";
import { libelleStrategieRetenue, type StrategieConstruite } from "@/lib/journey/strategies";
import { lignePiece, valeursPiece, type MetaRapport } from "@/lib/journey/report";
import { raisonJamais, texteRecuperation } from "@/lib/journey/payback";
import {
  descriptionHypothese,
  traduireAvertissement,
  traduireDonneeClient,
  traduireLibelleSubvention,
} from "@/lib/tco/translations-en";
import { EnTetePage, Piece, PiedPage, Tableau, Texte, Tuiles, styles } from "./pdf/theme";

interface CouncilReportPDFProps {
  langue: "fr" | "en";
  meta: MetaRapport;
  strategie: StrategieConstruite;
  sensibilite: ResultatSensibilite;
  unites: Map<string, string>;
}

export default function CouncilReportPDF({ langue, meta, strategie, sensibilite, unites }: CouncilReportPDFProps) {
  const en = langue === "en";
  const resultat = strategie.resultat as ResultatPlan;
  const plan = strategie.plan!;
  const cad = (v: number) =>
    new Intl.NumberFormat(en ? "en-CA" : "fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);
  const nb = (v: number) => new Intl.NumberFormat(en ? "en-CA" : "fr-CA", { maximumFractionDigits: 0 }).format(v);

  const van = resultat.vanDifferentielle;
  const sc = sensibilite.scenarios;
  const gagnants = [sc.prudent.van, sc.central.van, sc.favorable.van].filter((v) => v > 0).length;
  const risque = sensibilite.niveauRisque;
  const libRisque = en
    ? { faible: "Low", moyen: "Medium", eleve: "High" }[risque]
    : { faible: "Faible", moyen: "Moyen", eleve: "Élevé" }[risque];
  const statutsHyp: Record<string, string> = en
    ? { verifie: "verified", estimation: "estimate", a_valider: "to validate" }
    : { verifie: "vérifié", estimation: "estimation", a_valider: "à valider" };
  const strategieLib = libelleStrategieRetenue(meta.strategieRetenue ?? { cle: null, ecarts: 0 }, langue);
  const investissement = resultat.vueBudgetaire.reduce((a, l) => a + l.investissementAlt, 0);
  const reste = resultat.vueBudgetaire.reduce((a, l) => a + l.resteAFinancerAlt, 0);
  const achats = plan.vehicules
    .filter((v) => v.alternative.technologie !== "diesel")
    .map((v) => meta.anneeReference + (v.anneeAcquisition ?? 0))
    .sort((a, b) => a - b);

  // Titre d'action : la conclusion, en une phrase (chiffres du moteur).
  const titreAction =
    van > 0
      ? en
        ? `The plan saves ${cad(van)} in present value over ${meta.horizonAns} years and comes out ahead in ${gagnants} of the 3 stress-test scenarios`
        : `Le plan économise ${cad(van)} en valeur actualisée sur ${meta.horizonAns} ans et reste gagnant dans ${gagnants} des 3 scénarios du stress test`
      : en
        ? `The plan costs ${cad(-van)} more than the status quo in present value over ${meta.horizonAns} years: it should be revised before adoption`
        : `Le plan coûte ${cad(-van)} de plus que le statu quo en valeur actualisée sur ${meta.horizonAns} ans : il doit être revu avant adoption`;

  const constats = en
    ? [
        `- ${strategie.nbZeroEmission} of ${strategie.nbVehicules} vehicles move to zero emission${achats.length ? `, purchased between ${achats[0]} and ${achats[achats.length - 1]}` : ""}.`,
        `- Total investment: ${cad(investissement)} in current dollars, including ${cad(strategie.infra.totalCapex)} for charging and grid connection.`,
        `- Expected subsidies: ${cad(strategie.subventionsTotal)}; amount left to finance: ${cad(reste)}.`,
        `- Stress test: cautious-scenario NPV of ${cad(sc.prudent.van)}, favourable ${cad(sc.favorable.van)} (risk ${libRisque.toLowerCase()}).`,
        `- CO2e avoided: ${nb(resultat.co2EviteWtwTonnes)} t over the full cycle, ${nb(resultat.co2EviteTtwTonnes)} t at the tailpipe.`,
      ]
    : [
        `- ${strategie.nbZeroEmission} des ${strategie.nbVehicules} véhicules passent au zéro émission${achats.length ? `, achetés entre ${achats[0]} et ${achats[achats.length - 1]}` : ""}.`,
        `- Investissement total : ${cad(investissement)} en dollars courants, dont ${cad(strategie.infra.totalCapex)} pour la recharge et le raccordement.`,
        `- Subventions prévues : ${cad(strategie.subventionsTotal)} ; reste à financer : ${cad(reste)}.`,
        `- Stress test : VAN de ${cad(sc.prudent.van)} dans le scénario prudent, ${cad(sc.favorable.van)} dans le favorable (risque ${libRisque.toLowerCase()}).`,
        `- CO2e évité : ${nb(resultat.co2EviteWtwTonnes)} t sur le cycle complet, ${nb(resultat.co2EviteTtwTonnes)} t au pot d'échappement.`,
      ];

  const source = en
    ? `Source: H2Fleet engine ${ENGINE_VERSION}, input fingerprint ${resultat.empreinteEntree}, generated on ${meta.dateIso}.`
    : `Source : moteur H2Fleet ${ENGINE_VERSION}, empreinte des entrées ${resultat.empreinteEntree}, généré le ${meta.dateIso}.`;
  let n = 0;
  const piece = () => `${en ? "Exhibit" : "Pièce"} ${++n}`;
  const entete = <EnTetePage gauche={`${meta.organisation} — ${meta.projet}`} droite={en ? `Detailed report — ${meta.dateIso}` : `Rapport détaillé — ${meta.dateIso}`} />;
  const pied = <PiedPage en={en} gauche={`H2Fleet ${ENGINE_VERSION} · ${en ? "fingerprint" : "empreinte"} ${resultat.empreinteEntree}`} />;

  const avertissements = [
    ...(strategie.exclusions.length > 0
      ? [en ? `${strategie.exclusions.length} vehicle(s) in category "other" are outside the computation.` : `${strategie.exclusions.length} véhicule(s) de catégorie « autre » hors du calcul.`]
      : []),
    ...(strategie.sansAnnee.length > 0
      ? [
          en
            ? `${strategie.sansAnnee.length} vehicle(s) without a replacement year, treated as replaced in ${meta.anneeReference}.`
            : `${strategie.sansAnnee.length} véhicule(s) sans année de remplacement, traités comme remplacés en ${meta.anneeReference}.`,
        ]
      : []),
    ...(strategie.horsHorizon.length > 0
      ? [
          (() => {
            const liste = strategie.horsHorizon.map((h) => `${unites.get(h.id) ?? "?"} (${h.anneeRemplacement})`).join(", ");
            return en
              ? `${strategie.horsHorizon.length} vehicle(s) scheduled for replacement AFTER the ${meta.horizonAns}-year analysis horizon — excluded from every total and from the financing table: ${liste}.`
              : `${strategie.horsHorizon.length} véhicule(s) dont le remplacement est prévu APRÈS l'horizon d'analyse de ${meta.horizonAns} ans — exclus de tous les totaux et du tableau de financement : ${liste}.`;
          })(),
        ]
      : []),
    ...[...strategie.avertissementsSubventions, ...resultat.avertissements].slice(0, 9).map((a) => traduireAvertissement(a, langue)),
  ];

  return (
    <Document title={en ? `Fleet replacement plan — ${meta.projet}` : `Plan de remplacement de la flotte — ${meta.projet}`} author={meta.organisation} creator="H2Fleet">
      {/* Synthèse */}
      <Page size="LETTER" style={styles.page}>
        {entete}
        <Text style={styles.surtitre}>{en ? "DETAILED REPORT — FOR COUNCIL" : "RAPPORT DÉTAILLÉ — POUR LE CONSEIL"}</Text>
        <Text style={styles.titre}>{en ? "Fleet replacement plan" : "Plan de remplacement de la flotte"}</Text>
        <Text style={styles.meta}>
          {meta.organisation} — {meta.projet}
        </Text>
        <Text style={styles.meta}>{(en ? "Selected strategy: " : "Stratégie retenue : ") + strategieLib}</Text>
        <Text style={styles.meta}>
          {en
            ? `Generated on ${meta.dateIso} — horizon ${meta.horizonAns} years from ${meta.anneeReference} — engine ${ENGINE_VERSION}`
            : `Généré le ${meta.dateIso} — horizon ${meta.horizonAns} ans à partir de ${meta.anneeReference} — moteur ${ENGINE_VERSION}`}
        </Text>
        <View style={styles.filetEpais} />
        <Text style={[styles.titreAction, { fontSize: 14, marginBottom: 10 }]}>{titreAction}</Text>

        <Tuiles
          tuiles={[
            { libelle: en ? "Savings vs status quo (NPV)" : "Économie vs statu quo (VAN)", valeur: cad(van), negatif: van < 0 },
            { libelle: en ? "CO2e avoided (full cycle)" : "CO2e évité (cycle complet)", valeur: `${nb(resultat.co2EviteWtwTonnes)} t` },
            resultat.paybackActualise.annees != null
              ? { libelle: en ? "Discounted payback" : "Récupération actualisée", valeur: texteRecuperation(resultat.paybackActualise, resultat.horizonAns, en) }
              : {
                  libelle: en ? "Discounted payback" : "Récupération actualisée",
                  valeur: resultat.paybackActualise.code === "aucun_ecart" ? "—" : en ? "Never" : "Jamais",
                  note: raisonJamais(resultat.paybackActualise, resultat.horizonAns, en),
                },
            { libelle: en ? "Stress-test risk" : "Risque (stress test)", valeur: libRisque },
          ]}
        />
        <Tuiles
          tuiles={[
            { libelle: en ? "Plan TCO (discounted)" : "TCO du plan (actualisé)", valeur: cad(resultat.alternative.tcoActualise) },
            { libelle: en ? "Status quo TCO" : "TCO statu quo", valeur: cad(resultat.reference.tcoActualise) },
            { libelle: en ? "Zero-emission vehicles" : "Véhicules zéro émission", valeur: `${strategie.nbZeroEmission} / ${strategie.nbVehicules}` },
            { libelle: en ? "Expected subsidies" : "Subventions prévues", valeur: cad(strategie.subventionsTotal) },
          ]}
        />

        <Text style={styles.etiquetteSection}>{en ? "KEY FINDINGS" : "CONSTATS CLÉS"}</Text>
        <Texte texte={constats.join("\n")} />

        {/* Infrastructure : MÊME plan par garage que Stratégies, Plan, Financement et Excel */}
        <Piece
          numero={piece()}
          titre={en ? "Charging infrastructure by depot" : "Infrastructure de recharge par garage"}
          sousTitre={en ? "Before taxes; grid connection sized on requested vs available kW" : "Avant taxes ; raccordement dimensionné sur les kW demandés comparés aux kW disponibles"}
          source={source}
        >
          {strategie.infra.garages.length === 0 ? (
            <Text style={styles.note}>
              {en ? "No infrastructure: no zero-emission vehicle in this plan." : "Aucune infrastructure : aucun véhicule zéro émission dans ce plan."}
            </Text>
          ) : (
            <Tableau
              colonnes={[
                { titre: en ? "Depot" : "Garage", flex: 2 },
                { titre: en ? "Chargers" : "Bornes", flex: 1, droite: true },
                { titre: en ? "Grid connection" : "Raccordement", flex: 1, droite: true },
                { titre: en ? "H2 station" : "Station H2", flex: 1, droite: true },
                { titre: "Total", flex: 1, droite: true },
              ]}
              lignes={strategie.infra.garages.map((g) => [
                g.depot ?? (en ? "Depot not specified" : "Garage non précisé"),
                cad(g.capexBornes),
                cad(g.raccordement.cout),
                cad(g.capexStationH2),
                cad(g.capexTotal),
              ])}
              total={[en ? "Total infrastructure (before taxes)" : "Infrastructure totale (avant taxes)", "", "", "", cad(strategie.infra.totalCapex)]}
            />
          )}
        </Piece>

        <Piece
          numero={piece()}
          titre={en ? "Savings under three scenarios (methodology §7)" : "Économie selon trois scénarios (méthodologie §7)"}
          sousTitre={
            en
              ? "Each scenario re-runs the full engine at the sourced bounds of every assumption — never an arbitrary ±20%"
              : "Chaque scénario relance le moteur complet aux bornes sourcées de chaque hypothèse — jamais un ±20 % arbitraire"
          }
          source={source}
        >
          <Tableau
            colonnes={[
              { titre: en ? "Scenario" : "Scénario", flex: 3 },
              { titre: en ? "Savings (NPV)" : "Économie (VAN)", flex: 1.2, droite: true },
            ]}
            lignes={(["prudent", "central", "favorable"] as const).map((cle) => [
              en
                ? { prudent: "Cautious (all bounds unfavourable)", central: "Central", favorable: "Favourable" }[cle]
                : { prudent: "Prudent (toutes bornes défavorables)", central: "Central", favorable: "Favorable" }[cle],
              cad(sc[cle].van),
            ])}
            negatifs
          />
          <Text style={styles.note}>
            {en
              ? "The status quo replaces the same vehicles, in the same years, with equivalent new diesels."
              : "Le statu quo remplace les mêmes véhicules, les mêmes années, par des diesels neufs équivalents."}
          </Text>
        </Piece>

        {avertissements.length > 0 && (
          <View>
            <Text style={styles.etiquetteSection}>{en ? "POINTS OF ATTENTION" : "POINTS D'ATTENTION"}</Text>
            <Texte texte={avertissements.map((a) => `- ${a}`).join("\n")} />
          </View>
        )}
        {pied}
      </Page>

      {/* Budget et véhicules */}
      <Page size="LETTER" style={styles.page}>
        {entete}
        <Piece
          numero={piece()}
          titre={en ? "Annual budget (current dollars)" : "Budget annuel (dollars courants)"}
          sousTitre={en ? "Plan vs status quo; the gap is positive when the plan costs less" : "Plan comparé au statu quo ; l'écart est positif quand le plan coûte moins cher"}
          source={source}
        >
          <Tableau
            colonnes={[
              { titre: en ? "Year" : "Année", flex: 0.7 },
              { titre: en ? "Investment" : "Investissement", flex: 1, droite: true },
              { titre: en ? "Subsidies" : "Subventions", flex: 1, droite: true },
              { titre: en ? "To finance" : "Reste à financer", flex: 1, droite: true },
              { titre: en ? "Operating" : "Fonctionnement", flex: 1, droite: true },
              { titre: en ? "Gap vs SQ" : "Écart vs SQ", flex: 1, droite: true },
            ]}
            lignes={resultat.vueBudgetaire.map((l) => [
              String(l.annee),
              l.investissementAlt ? cad(l.investissementAlt) : "—",
              l.subventionsAlt ? cad(l.subventionsAlt) : "—",
              l.resteAFinancerAlt ? cad(l.resteAFinancerAlt) : "—",
              l.fonctionnementAlt ? cad(l.fonctionnementAlt) : "—",
              cad(l.ecart),
            ])}
            negatifs
          />
        </Piece>

        <Piece
          numero={piece()}
          titre={en ? "Vehicles and subsidies" : "Véhicules et subventions"}
          sousTitre={en ? "Programs counted by the resolver (eligibility, caps, stacking)" : "Programmes retenus par le résolveur (admissibilité, plafonds, cumul)"}
          source={source}
        >
          <Tableau
            colonnes={[
              { titre: en ? "Unit" : "Unité", flex: 0.8 },
              { titre: en ? "Target" : "Cible", flex: 0.8 },
              { titre: en ? "Year" : "Année", flex: 0.6 },
              { titre: en ? "Programs" : "Programmes", flex: 2.5 },
              { titre: en ? "Subsidies" : "Subventions", flex: 0.9, droite: true },
            ]}
            lignes={plan.vehicules.map((v) => {
              const subventions = v.subventionsAlternative ?? [];
              return [
                unites.get(v.id) ?? v.id,
                v.alternative.technologie === "diesel" ? "Diesel (SQ)" : v.alternative.technologie,
                String(meta.anneeReference + (v.anneeAcquisition ?? 0)),
                subventions.map((x) => `${traduireLibelleSubvention(x.libelle, langue)} (${cad(x.montant)})`).join(" ; ") || "—",
                cad(subventions.reduce((a, x) => a + x.montant, 0)),
              ];
            })}
            total={[en ? "Total" : "Total", "", "", "", cad(strategie.subventionsTotal)]}
          />
        </Piece>
        {pied}
      </Page>

      {/* Annexes */}
      <Page size="LETTER" style={styles.page}>
        {entete}
        <Text style={styles.etiquetteSection}>{en ? "APPENDIX A — METHODOLOGY" : "ANNEXE A — MÉTHODOLOGIE"}</Text>
        <Text style={styles.titreAction}>
          {en ? "Every figure is reproducible from its inputs and sourced assumptions" : "Chaque chiffre est reproductible à partir de ses entrées et d'hypothèses sourcées"}
        </Text>
        <Text style={styles.paragraphe}>
          {en
            ? "Method (docs/tco-methodologie.md): year 0 = acquisition (undiscounted); operating flows are nominal (per-item inflation) and discounted at the nominal rate; the reference is the same fleet replaced on the same schedule by equivalent new diesels; subsidies are counted in their payment year and capped by stacking rules; residual values are geometric with a floor. CO2e: two scopes are shown side by side — tailpipe (tank-to-wheel, what leaves the exhaust; zero for electric and hydrogen) and full cycle (well-to-wheel: fuel extraction and refining, electricity grid, hydrogen production); the FULL CYCLE is used in every total and in the cost per tonne. A gasoline vehicle is compared with a new gasoline vehicle (gasoline price and emission factor). Every assumption below carries an honest status: an amount is only “verified” if the official source was actually read on the indicated date."
            : "Méthode (docs/tco-methodologie.md) : année 0 = acquisition (non actualisée) ; flux d'exploitation nominaux (inflation par poste) actualisés au taux nominal ; la référence est la même flotte remplacée au même calendrier par des diesels neufs équivalents ; les subventions sont comptées à leur année de versement et plafonnées par les règles de cumul ; valeurs résiduelles géométriques avec plancher. CO2e : deux périmètres côte à côte — au pot d'échappement (réservoir à la roue, ce qui sort de l'échappement ; nul pour l'électrique et l'hydrogène) et cycle complet (puits à la roue : extraction et raffinage du carburant, réseau électrique, production d'hydrogène) ; le CYCLE COMPLET est retenu dans tous les totaux et dans le coût par tonne. Un véhicule à essence est comparé à un véhicule neuf à essence (prix et facteur d'émission de l'essence). Chaque hypothèse ci-dessous porte un statut honnête : un montant n'est « vérifié » que si la source officielle a réellement été lue à la date indiquée."}
        </Text>
        {(meta.donneesClient?.length ?? 0) > 0 && (
          <View>
            <Text style={styles.etiquetteSection}>{en ? "APPENDIX B — CLIENT DATA" : "ANNEXE B — DONNÉES CLIENT"}</Text>
            <Text style={styles.paragraphe}>
              {en
                ? "The following values were provided by the organization and take precedence over the registry defaults below:"
                : "Les valeurs suivantes ont été fournies par l'organisation et priment sur les défauts du registre ci-dessous :"}
            </Text>
            <Texte texte={meta.donneesClient!.map((d) => `- ${traduireDonneeClient(d, langue)}`).join("\n")} />
          </View>
        )}
        {(meta.pieces?.length ?? 0) > 0 && (
          <View>
            <Text style={styles.etiquetteSection}>{en ? "APPENDIX C — SUPPORTING DOCUMENTS" : "ANNEXE C — PIÈCES JUSTIFICATIVES"}</Text>
            <Text style={styles.paragraphe}>
              {en
                ? "Invoices and quotes confirmed by the organization; each file is kept unaltered in private storage and identified by its SHA-256 fingerprint."
                : "Factures et devis confirmés par l'organisation ; chaque fichier est conservé sans modification dans un stockage privé et identifié par son empreinte SHA-256."}
            </Text>
            {meta.pieces!.map((p, i) => (
              <View key={i} wrap={false}>
                <Text style={styles.paragraphe}>• {lignePiece(p, langue)}</Text>
                {p.valeurs.length > 0 && <Text style={[styles.note, { marginLeft: 8, marginBottom: 4 }]}>{valeursPiece(p, langue)}</Text>}
              </View>
            ))}
          </View>
        )}
        <Text style={styles.etiquetteSection}>{en ? "APPENDIX D — ASSUMPTION REGISTRY" : "ANNEXE D — REGISTRE DES HYPOTHÈSES"}</Text>
        <Tableau
          colonnes={[
            { titre: en ? "Assumption" : "Hypothèse", flex: 2.5 },
            { titre: en ? "Value" : "Valeur", flex: 0.8, droite: true },
            { titre: en ? "Unit" : "Unité", flex: 0.8 },
            { titre: en ? "Status" : "Statut", flex: 0.8 },
            { titre: "Source", flex: 1.6 },
            { titre: en ? "Read on" : "Lue le", flex: 0.8 },
          ]}
          lignes={LISTE_HYPOTHESES.map((h) => [
            descriptionHypothese(h.id, langue),
            // Taux d'actualisation : la valeur RÉELLEMENT utilisée (paramètre du projet), pas le défaut du registre (A5).
            String(h.id === "taux_actualisation_nominal" ? meta.tauxActualisationNominal : h.valeur),
            h.unite,
            h.id === "taux_actualisation_nominal" ? (en ? "project setting" : "paramètre du projet") : (statutsHyp[h.statut] ?? h.statut),
            `${h.source.organisme} (${h.source.annee})`,
            h.dateVerification,
          ])}
        />
        <Text style={styles.note}>
          {en
            ? `Input fingerprint ${resultat.empreinteEntree} (engine ${ENGINE_VERSION}): the same fingerprint and version always reproduce these exact figures.`
            : `Empreinte des entrées ${resultat.empreinteEntree} (moteur ${ENGINE_VERSION}) : la même empreinte et la même version reproduisent exactement ces chiffres.`}
        </Text>
        {pied}
      </Page>
    </Document>
  );
}
