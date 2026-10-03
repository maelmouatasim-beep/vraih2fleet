/**
 * Phase 5.7 — NOTE AU CONSEIL (PDF), au standard des cabinets de conseil :
 * recommandation d'abord, chiffres clés, sections dont la première phrase
 * est la conclusion, pièces numérotées et sourcées, limites dites
 * honnêtement, annexe de traçabilité (chaque nombre = un fait du moteur).
 * Le TEXTE est celui validé par l'utilisateur (nombres vérifiés) ; les
 * TABLEAUX viennent directement du résultat du moteur.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { ResultatSensibilite } from "@/lib/tco";
import type { StrategieConstruite } from "@/lib/journey/strategies";
import type { FaitNote, SectionsNote } from "@/lib/journey/councilNote";
import { EnTetePage, Encadre, Piece, PiedPage, Section, Tableau, Texte, Tuiles, styles } from "./pdf/theme";

export interface MetaNote {
  organisation: string;
  projet: string;
  dateIso: string;
  strategie: string;
  /** Snapshot du plan figé à l'export. */
  snapshotDate: string;
  moteur: string;
  empreinte: string;
}

interface Props {
  langue: "fr" | "en";
  sections: SectionsNote;
  faits: FaitNote[];
  meta: MetaNote;
  strategie: StrategieConstruite;
  sensibilite: ResultatSensibilite;
}

export default function CouncilNotePDF({ langue, sections, faits, meta, strategie, sensibilite }: Props) {
  const en = langue === "en";
  const r = strategie.resultat!;
  const cad = (v: number) =>
    new Intl.NumberFormat(en ? "en-CA" : "fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);
  const fait = (id: string) => faits.find((f) => f.id === id)?.rendu[langue] ?? "—";
  const sourceMoteur = en
    ? `Source: H2Fleet engine ${meta.moteur}, input fingerprint ${meta.empreinte}, plan frozen on ${meta.snapshotDate}.`
    : `Source : moteur H2Fleet ${meta.moteur}, empreinte des entrées ${meta.empreinte}, plan figé le ${meta.snapshotDate}.`;
  let n = 0;
  const piece = () => `${en ? "Exhibit" : "Pièce"} ${++n}`;
  const budget = r.vueBudgetaire.filter((l) => l.investissementAlt || l.subventionsAlt);
  const van = r.vanDifferentielle;

  return (
    <Document title={en ? `Note to council — ${meta.projet}` : `Note au conseil — ${meta.projet}`} author={meta.organisation} creator="H2Fleet">
      <Page size="LETTER" style={styles.page}>
        <EnTetePage gauche={meta.organisation} droite={en ? `Note to council — ${meta.dateIso}` : `Note au conseil — ${meta.dateIso}`} />
        <Text style={styles.surtitre}>{en ? "NOTE TO COUNCIL — DECISION MEMO" : "NOTE AU CONSEIL — SOMMAIRE DÉCISIONNEL"}</Text>
        <Text style={styles.titre}>{en ? `Fleet replacement plan: ${meta.projet}` : `Plan de remplacement de la flotte : ${meta.projet}`}</Text>
        <Text style={styles.meta}>
          {meta.organisation} · {meta.dateIso} · {en ? "Selected strategy: " : "Stratégie retenue : "}
          {meta.strategie}
        </Text>
        <View style={styles.filetEpais} />

        <Tuiles
          tuiles={[
            { libelle: en ? "Savings vs status quo (NPV)" : "Économie vs statu quo (VAN)", valeur: fait("van_centrale"), negatif: van < 0 },
            { libelle: en ? "Total investment" : "Investissement total", valeur: fait("investissement_total") },
            { libelle: en ? "Expected subsidies" : "Subventions prévues", valeur: fait("subventions_total") },
            { libelle: en ? "Winning scenarios" : "Scénarios gagnants", valeur: `${fait("scenarios_gagnants")} / ${fait("nb_scenarios")}` },
          ]}
        />

        <Encadre titre={en ? "Recommendation" : "Recommandation"} texte={sections.recommandation} />

        <Section etiquette={en ? "1 · Context" : "1 · Contexte"} texte={sections.contexte} />

        <Section etiquette={en ? "2 · Costs and benefits" : "2 · Coûts et bénéfices"} texte={sections.couts}>
          <Piece
            numero={piece()}
            titre={en ? "Discounted cost of the plan against the status quo" : "Coût actualisé du plan comparé au statu quo"}
            sousTitre={en ? `Over ${fait("horizon_ans")}, discounted at ${fait("taux_actualisation")}` : `Sur ${fait("horizon_ans")}, actualisé à ${fait("taux_actualisation")}`}
            source={sourceMoteur}
          >
            <Tableau
              colonnes={[
                { titre: en ? "Indicator" : "Indicateur", flex: 3 },
                { titre: en ? "Value" : "Valeur", flex: 1.4, droite: true },
              ]}
              lignes={[
                [en ? "Discounted total cost — plan" : "Coût total actualisé — plan", fait("tco_plan")],
                [en ? "Discounted total cost — status quo (new combustion)" : "Coût total actualisé — statu quo (combustion neuf)", fait("tco_statu_quo")],
                [en ? "Discounted payback" : "Récupération actualisée", fait("recuperation")],
                [en ? "CO2e avoided — full cycle" : "CO2e évité — cycle complet", fait("co2_evite_t")],
                [en ? "CO2e avoided — tailpipe" : "CO2e évité — au pot d'échappement", fait("co2_evite_pot_t")],
              ]}
              total={[en ? "Savings vs status quo (NPV)" : "Économie vs statu quo (VAN)", fait("van_centrale")]}
              negatifs
            />
          </Piece>
        </Section>

        <Section etiquette={en ? "3 · Financing" : "3 · Financement"} texte={sections.financement}>
          {budget.length > 0 && (
            <Piece
              numero={piece()}
              titre={en ? "Investment schedule and amount to finance" : "Calendrier d'investissement et reste à financer"}
              sousTitre={en ? "Current dollars, before taxes recoverable by the organization" : "Dollars courants, avant les taxes récupérables par l'organisation"}
              source={sourceMoteur}
            >
              <Tableau
                colonnes={[
                  { titre: en ? "Year" : "Année", flex: 0.8 },
                  { titre: en ? "Investment" : "Investissement", flex: 1.2, droite: true },
                  { titre: en ? "Subsidies" : "Subventions", flex: 1.2, droite: true },
                  { titre: en ? "To finance" : "Reste à financer", flex: 1.2, droite: true },
                ]}
                lignes={budget.map((l) => [String(l.annee), cad(l.investissementAlt), l.subventionsAlt ? cad(l.subventionsAlt) : "—", cad(l.resteAFinancerAlt)])}
                total={[en ? "Total" : "Total", fait("investissement_total"), fait("subventions_total"), fait("reste_a_financer")]}
              />
            </Piece>
          )}
        </Section>

        <Section etiquette={en ? "4 · Risks and stress test" : "4 · Risques et stress test"} texte={sections.risques}>
          <Piece
            numero={piece()}
            titre={en ? "Savings under three scenarios" : "Économie selon trois scénarios"}
            sousTitre={
              en
                ? "Each scenario re-runs the full engine at the sourced bounds of every assumption"
                : "Chaque scénario relance le moteur complet aux bornes sourcées de chaque hypothèse"
            }
            source={sourceMoteur}
          >
            <Tableau
              colonnes={[
                { titre: en ? "Scenario" : "Scénario", flex: 3 },
                { titre: en ? "Savings (NPV)" : "Économie (VAN)", flex: 1.4, droite: true },
              ]}
              lignes={[
                [en ? "Cautious — every bound unfavourable" : "Prudent — toutes les bornes défavorables", cad(sensibilite.scenarios.prudent.van)],
                [en ? "Central" : "Central", cad(sensibilite.scenarios.central.van)],
                [en ? "Favourable" : "Favorable", cad(sensibilite.scenarios.favorable.van)],
              ]}
              negatifs
            />
            {faits.some((f) => f.id === "facteurs_influents") && (
              <Text style={styles.note}>
                {en ? "Most influential factors: " : "Facteurs les plus influents : "}
                {fait("facteurs_influents")}
              </Text>
            )}
          </Piece>
        </Section>

        <Section etiquette={en ? "5 · Winter operation" : "5 · Exploitation hivernale"} texte={sections.hiver} />

        <Section etiquette={en ? "6 · Next steps" : "6 · Prochaines étapes"} texte={sections.prochaines_etapes} />

        <View wrap={false}>
          <Text style={styles.etiquetteSection}>{en ? "WHAT THIS NOTE DOES NOT SAY" : "CE QUE CETTE NOTE NE DIT PAS"}</Text>
          <Texte
            texte={
              en
                ? [
                    "- Subsidies are estimates under the rules in force on the verification date; none is secured before the application is accepted.",
                    "- Future energy prices are uncertain: the stress test bounds them with sourced ranges, not forecasts.",
                    `- ${fait("hypotheses_a_valider")} registry assumptions are still to be validated at the source and ${fait("hypotheses_estimations")} are estimates (detailed report, appendix).`,
                    "- The winter diagnostic assumes a typical model per category; it does not replace a road test.",
                  ].join("\n")
                : [
                    "- Les subventions sont estimées selon les règles en vigueur à la date de vérification ; aucune n'est acquise avant l'acceptation de la demande.",
                    "- Les prix futurs de l'énergie sont incertains : le stress test les borne par des plages sourcées, pas par des prévisions.",
                    `- ${fait("hypotheses_a_valider")} hypothèses du registre restent à valider à la source et ${fait("hypotheses_estimations")} sont des estimations (rapport détaillé, annexe).`,
                    "- Le diagnostic hivernal suppose un modèle type par catégorie ; il ne remplace pas un essai routier.",
                  ].join("\n")
            }
          />
        </View>
        <PiedPage en={en} gauche={`H2Fleet ${meta.moteur} · ${en ? "fingerprint" : "empreinte"} ${meta.empreinte}`} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <EnTetePage gauche={meta.organisation} droite={en ? `Note to council — ${meta.dateIso}` : `Note au conseil — ${meta.dateIso}`} />
        <Text style={styles.etiquetteSection}>{en ? "APPENDIX — TRACEABILITY OF FIGURES" : "ANNEXE — TRAÇABILITÉ DES CHIFFRES"}</Text>
        <Text style={styles.titreAction}>
          {en ? "Every figure in this note is an engine output" : "Chaque chiffre de cette note est une sortie du moteur"}
        </Text>
        <Text style={styles.paragraphe}>
          {en
            ? `The text was drafted with figures inserted from the facts below and checked number by number before export; a figure that matches no fact blocks the export. The same fingerprint and engine version always reproduce these figures. Plan frozen on ${meta.snapshotDate}.`
            : `Le texte a été rédigé avec des chiffres insérés à partir des faits ci-dessous, puis vérifié nombre par nombre avant l'export ; un nombre qui ne correspond à aucun fait bloque l'export. La même empreinte et la même version du moteur reproduisent toujours ces chiffres. Plan figé le ${meta.snapshotDate}.`}
        </Text>
        <Tableau
          colonnes={[
            { titre: en ? "Fact" : "Fait", flex: 2.5 },
            { titre: en ? "Value" : "Valeur", flex: 2.2, droite: true },
            { titre: "Source", flex: 1.6, retrait: 14 },
          ]}
          lignes={faits
            .filter((f) => !["organisation", "projet", "empreinte"].includes(f.id))
            .map((f) => [f.libelle[langue], f.rendu[langue], f.source[langue]])}
        />
        <PiedPage en={en} gauche={`H2Fleet ${meta.moteur} · ${en ? "fingerprint" : "empreinte"} ${meta.empreinte}`} />
      </Page>
    </Document>
  );
}
