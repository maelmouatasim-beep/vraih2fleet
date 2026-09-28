/**
 * Rapport « prêt pour le conseil » (fr/en) — généré depuis le RÉSULTAT
 * DU MOTEUR (aucun chiffre recalculé ici) : résumé exécutif, plan
 * annuel, véhicules et subventions, stress test, annexe méthodologie
 * (hypothèses du registre avec statut et date de vérification).
 */
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { ENGINE_VERSION, LISTE_HYPOTHESES, type ResultatPlan } from "@/lib/tco";
import type { ResultatSensibilite } from "@/lib/tco";
import type { StrategieConstruite } from "@/lib/journey/strategies";
import type { MetaRapport } from "@/lib/journey/report";

const C = {
  primaire: "#0f766e",
  texte: "#1f2937",
  gris: "#6b7280",
  ligne: "#e5e7eb",
  fondEnTete: "#f0fdfa",
  rouge: "#b91c1c",
};

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: C.texte, fontFamily: "Helvetica" },
  h1: { fontSize: 18, color: C.primaire, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 12, color: C.primaire, marginTop: 14, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  meta: { color: C.gris, marginBottom: 2 },
  carteRangee: { flexDirection: "row", gap: 8, marginTop: 8 },
  carte: { flex: 1, border: `1 solid ${C.ligne}`, borderRadius: 4, padding: 8 },
  carteTitre: { color: C.gris, fontSize: 7.5, marginBottom: 3 },
  carteValeur: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  ligneTable: { flexDirection: "row", borderBottom: `0.5 solid ${C.ligne}`, paddingVertical: 3 },
  enTeteTable: {
    flexDirection: "row",
    backgroundColor: C.fondEnTete,
    borderBottom: `1 solid ${C.primaire}`,
    paddingVertical: 4,
    fontFamily: "Helvetica-Bold",
  },
  cel: { paddingHorizontal: 3 },
  droite: { textAlign: "right" },
  note: { color: C.gris, marginTop: 6, lineHeight: 1.4 },
  pied: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    color: C.gris,
    fontSize: 7,
  },
});

interface CouncilReportPDFProps {
  langue: "fr" | "en";
  meta: MetaRapport;
  strategie: StrategieConstruite;
  sensibilite: ResultatSensibilite;
  unites: Map<string, string>;
}

export default function CouncilReportPDF({
  langue,
  meta,
  strategie,
  sensibilite,
  unites,
}: CouncilReportPDFProps) {
  const en = langue === "en";
  const resultat = strategie.resultat as ResultatPlan;
  const plan = strategie.plan!;
  const cad = (v: number) =>
    new Intl.NumberFormat(en ? "en-CA" : "fr-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(v);

  const van = resultat.vanDifferentielle;
  const risque = sensibilite.niveauRisque;
  const libRisque = en
    ? { faible: "Low", moyen: "Medium", eleve: "High" }[risque]
    : { faible: "Faible", moyen: "Moyen", eleve: "Élevé" }[risque];
  const statutsHyp: Record<string, string> = en
    ? { verifie: "verified", estimation: "estimate", a_valider: "to validate" }
    : { verifie: "vérifié", estimation: "estimation", a_valider: "à valider" };

  const pied = (
    <View style={s.pied} fixed>
      <Text>
        {meta.organisation} — {meta.projet}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `${en ? "Page" : "Page"} ${pageNumber} / ${totalPages} — H2Fleet ${ENGINE_VERSION} — ${resultat.empreinteEntree}`
        }
      />
    </View>
  );

  return (
    <Document>
      {/* Page 1 — résumé exécutif */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>
          {en ? "Fleet replacement plan" : "Plan de remplacement de la flotte"}
        </Text>
        <Text style={s.meta}>
          {meta.organisation} — {meta.projet}
        </Text>
        <Text style={s.meta}>
          {en
            ? `Generated on ${meta.dateIso} — horizon ${meta.horizonAns} years from ${meta.anneeReference} — engine ${ENGINE_VERSION}`
            : `Généré le ${meta.dateIso} — horizon ${meta.horizonAns} ans à partir de ${meta.anneeReference} — moteur ${ENGINE_VERSION}`}
        </Text>

        <View style={s.carteRangee}>
          <View style={s.carte}>
            <Text style={s.carteTitre}>
              {en ? "Savings vs status quo (NPV)" : "Économie vs statu quo (VAN)"}
            </Text>
            <Text style={[s.carteValeur, van < 0 ? { color: C.rouge } : { color: C.primaire }]}>
              {cad(van)}
            </Text>
          </View>
          <View style={s.carte}>
            <Text style={s.carteTitre}>{en ? "CO2e avoided (WTW)" : "CO2e évité (puits à la roue)"}</Text>
            <Text style={s.carteValeur}>{resultat.co2EviteWtwTonnes.toFixed(0)} t</Text>
          </View>
          <View style={s.carte}>
            <Text style={s.carteTitre}>{en ? "Discounted payback" : "Récupération actualisée"}</Text>
            <Text style={s.carteValeur}>
              {resultat.paybackActualise.annees != null
                ? `${resultat.paybackActualise.annees} ${en ? "yrs" : "ans"}`
                : "—"}
            </Text>
          </View>
          <View style={s.carte}>
            <Text style={s.carteTitre}>{en ? "Stress-test risk" : "Risque (stress test)"}</Text>
            <Text style={s.carteValeur}>{libRisque}</Text>
          </View>
        </View>

        <View style={s.carteRangee}>
          <View style={s.carte}>
            <Text style={s.carteTitre}>{en ? "Plan TCO (discounted)" : "TCO du plan (actualisé)"}</Text>
            <Text style={s.carteValeur}>{cad(resultat.alternative.tcoActualise)}</Text>
          </View>
          <View style={s.carte}>
            <Text style={s.carteTitre}>
              {en ? "Status quo TCO (new diesel)" : "TCO statu quo (diesel neuf)"}
            </Text>
            <Text style={s.carteValeur}>{cad(resultat.reference.tcoActualise)}</Text>
          </View>
          <View style={s.carte}>
            <Text style={s.carteTitre}>{en ? "Zero-emission vehicles" : "Véhicules zéro émission"}</Text>
            <Text style={s.carteValeur}>
              {strategie.nbZeroEmission} / {strategie.nbVehicules}
            </Text>
          </View>
          <View style={s.carte}>
            <Text style={s.carteTitre}>{en ? "Expected subsidies" : "Subventions prévues"}</Text>
            <Text style={s.carteValeur}>{cad(strategie.subventionsTotal)}</Text>
          </View>
        </View>

        <Text style={s.h2}>{en ? "Stress test (methodology §7)" : "Stress test (méthodologie §7)"}</Text>
        <View style={s.enTeteTable}>
          <Text style={[s.cel, { flex: 2 }]}>{en ? "Scenario" : "Scénario"}</Text>
          <Text style={[s.cel, s.droite, { flex: 1 }]}>{en ? "Savings (NPV)" : "Économie (VAN)"}</Text>
        </View>
        {(["prudent", "central", "favorable"] as const).map((cle) => (
          <View key={cle} style={s.ligneTable}>
            <Text style={[s.cel, { flex: 2 }]}>
              {en
                ? { prudent: "Prudent (all bounds unfavourable)", central: "Central", favorable: "Favourable" }[cle]
                : { prudent: "Prudent (toutes bornes défavorables)", central: "Central", favorable: "Favorable" }[cle]}
            </Text>
            <Text style={[s.cel, s.droite, { flex: 1 }]}>{cad(sensibilite.scenarios[cle].van)}</Text>
          </View>
        ))}
        <Text style={s.note}>
          {en
            ? "Each scenario re-runs the full engine at the sourced bounds of every assumption (registry ranges) — never an arbitrary ±20%. The status quo replaces the same vehicles in the same years with equivalent new diesels."
            : "Chaque scénario relance le moteur complet aux bornes sourcées de chaque hypothèse (plages du registre) — jamais un ±20 % arbitraire. Le statu quo remplace les mêmes véhicules, les mêmes années, par des diesels neufs équivalents."}
        </Text>
        {(strategie.exclusions.length > 0 || strategie.sansAnnee.length > 0 || resultat.avertissements.length > 0) && (
          <>
            <Text style={s.h2}>{en ? "Warnings" : "Avertissements"}</Text>
            {strategie.exclusions.length > 0 && (
              <Text style={s.note}>
                {en
                  ? `${strategie.exclusions.length} vehicle(s) in category "other" are outside the computation.`
                  : `${strategie.exclusions.length} véhicule(s) de catégorie « autre » hors du calcul.`}
              </Text>
            )}
            {strategie.sansAnnee.length > 0 && (
              <Text style={s.note}>
                {en
                  ? `${strategie.sansAnnee.length} vehicle(s) without a replacement year, treated as replaced in ${meta.anneeReference}.`
                  : `${strategie.sansAnnee.length} véhicule(s) sans année de remplacement, traités comme remplacés en ${meta.anneeReference}.`}
              </Text>
            )}
            {resultat.avertissements.slice(0, 6).map((a, i) => (
              <Text key={i} style={s.note}>
                • {a}
              </Text>
            ))}
          </>
        )}
        {pied}
      </Page>

      {/* Page 2 — plan annuel */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>{en ? "Annual budget (current dollars)" : "Budget annuel (dollars courants)"}</Text>
        <View style={s.enTeteTable}>
          <Text style={[s.cel, { flex: 0.7 }]}>{en ? "Year" : "Année"}</Text>
          <Text style={[s.cel, s.droite, { flex: 1 }]}>{en ? "Investment" : "Investissement"}</Text>
          <Text style={[s.cel, s.droite, { flex: 1 }]}>{en ? "Subsidies" : "Subventions"}</Text>
          <Text style={[s.cel, s.droite, { flex: 1 }]}>{en ? "To finance" : "Reste à financer"}</Text>
          <Text style={[s.cel, s.droite, { flex: 1 }]}>{en ? "Operating" : "Fonctionnement"}</Text>
          <Text style={[s.cel, s.droite, { flex: 1 }]}>{en ? "Gap vs SQ" : "Écart vs SQ"}</Text>
        </View>
        {resultat.vueBudgetaire.map((l) => (
          <View key={l.annee} style={s.ligneTable}>
            <Text style={[s.cel, { flex: 0.7 }]}>{l.annee}</Text>
            <Text style={[s.cel, s.droite, { flex: 1 }]}>{l.investissementAlt ? cad(l.investissementAlt) : "—"}</Text>
            <Text style={[s.cel, s.droite, { flex: 1 }]}>{l.subventionsAlt ? cad(l.subventionsAlt) : "—"}</Text>
            <Text style={[s.cel, s.droite, { flex: 1 }]}>{l.resteAFinancerAlt ? cad(l.resteAFinancerAlt) : "—"}</Text>
            <Text style={[s.cel, s.droite, { flex: 1 }]}>{l.fonctionnementAlt ? cad(l.fonctionnementAlt) : "—"}</Text>
            <Text style={[s.cel, s.droite, { flex: 1 }, l.ecart < 0 ? { color: C.rouge } : {}]}>
              {cad(l.ecart)}
            </Text>
          </View>
        ))}

        <Text style={s.h2}>{en ? "Vehicles and subsidies" : "Véhicules et subventions"}</Text>
        <View style={s.enTeteTable}>
          <Text style={[s.cel, { flex: 0.8 }]}>{en ? "Unit" : "Unité"}</Text>
          <Text style={[s.cel, { flex: 0.8 }]}>{en ? "Target" : "Cible"}</Text>
          <Text style={[s.cel, { flex: 0.7 }]}>{en ? "Year" : "Année"}</Text>
          <Text style={[s.cel, { flex: 2.4 }]}>{en ? "Programs" : "Programmes"}</Text>
          <Text style={[s.cel, s.droite, { flex: 0.9 }]}>{en ? "Subsidies" : "Subventions"}</Text>
        </View>
        {plan.vehicules.map((v) => {
          const subventions = v.subventionsAlternative ?? [];
          return (
            <View key={v.id} style={s.ligneTable}>
              <Text style={[s.cel, { flex: 0.8 }]}>{unites.get(v.id) ?? v.id}</Text>
              <Text style={[s.cel, { flex: 0.8 }]}>
                {v.alternative.technologie === "diesel"
                  ? en
                    ? "Diesel (SQ)"
                    : "Diesel (SQ)"
                  : v.alternative.technologie}
              </Text>
              <Text style={[s.cel, { flex: 0.7 }]}>{meta.anneeReference + (v.anneeAcquisition ?? 0)}</Text>
              <Text style={[s.cel, { flex: 2.4 }]}>
                {subventions.map((x) => `${x.libelle} (${cad(x.montant)})`).join(" ; ") || "—"}
              </Text>
              <Text style={[s.cel, s.droite, { flex: 0.9 }]}>
                {cad(subventions.reduce((a, x) => a + x.montant, 0))}
              </Text>
            </View>
          );
        })}
        {pied}
      </Page>

      {/* Page 3+ — annexe méthodologie et hypothèses */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>
          {en ? "Appendix — methodology and assumptions" : "Annexe — méthodologie et hypothèses"}
        </Text>
        <Text style={s.note}>
          {en
            ? "Method (docs/tco-methodologie.md): year 0 = acquisition (undiscounted); operating flows are nominal (per-item inflation) and discounted at the nominal rate; the reference is the same fleet replaced on the same schedule by equivalent new diesels; subsidies are counted in their payment year and capped by stacking rules; residual values are geometric with a floor. Every assumption below carries an honest status: an amount is only “verified” if the official source was actually read on the indicated date."
            : "Méthode (docs/tco-methodologie.md) : année 0 = acquisition (non actualisée) ; flux d'exploitation nominaux (inflation par poste) actualisés au taux nominal ; la référence est la même flotte remplacée au même calendrier par des diesels neufs équivalents ; les subventions sont comptées à leur année de versement et plafonnées par les règles de cumul ; valeurs résiduelles géométriques avec plancher. Chaque hypothèse ci-dessous porte un statut honnête : un montant n'est « vérifié » que si la source officielle a réellement été lue à la date indiquée."}
        </Text>
        <View style={[s.enTeteTable, { marginTop: 8 }]}>
          <Text style={[s.cel, { flex: 2.6 }]}>{en ? "Assumption" : "Hypothèse"}</Text>
          <Text style={[s.cel, s.droite, { flex: 0.8 }]}>{en ? "Value" : "Valeur"}</Text>
          <Text style={[s.cel, { flex: 0.8 }]}>{en ? "Unit" : "Unité"}</Text>
          <Text style={[s.cel, { flex: 0.8 }]}>{en ? "Status" : "Statut"}</Text>
          <Text style={[s.cel, { flex: 1.6 }]}>Source</Text>
          <Text style={[s.cel, { flex: 0.8 }]}>{en ? "Read on" : "Lue le"}</Text>
        </View>
        {LISTE_HYPOTHESES.map((h) => (
          <View key={h.id} style={s.ligneTable} wrap={false}>
            <Text style={[s.cel, { flex: 2.6 }]}>{h.description}</Text>
            <Text style={[s.cel, s.droite, { flex: 0.8 }]}>{h.valeur}</Text>
            <Text style={[s.cel, { flex: 0.8 }]}>{h.unite}</Text>
            <Text style={[s.cel, { flex: 0.8 }]}>{statutsHyp[h.statut] ?? h.statut}</Text>
            <Text style={[s.cel, { flex: 1.6 }]}>
              {h.source.organisme} ({h.source.annee})
            </Text>
            <Text style={[s.cel, { flex: 0.8 }]}>{h.dateVerification}</Text>
          </View>
        ))}
        <Text style={s.note}>
          {en
            ? `Input fingerprint ${resultat.empreinteEntree} (engine ${ENGINE_VERSION}): the same fingerprint and version always reproduce these exact figures.`
            : `Empreinte des entrées ${resultat.empreinteEntree} (moteur ${ENGINE_VERSION}) : la même empreinte et la même version reproduisent exactement ces chiffres.`}
        </Text>
        {pied}
      </Page>
    </Document>
  );
}
