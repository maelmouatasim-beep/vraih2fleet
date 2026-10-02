/**
 * Démo (Phase 5.4) : PIÈCES FICTIVES de la Ville de Rivière-Claire pour
 * essayer la lecture de factures et de devis — une facture de diesel et
 * un devis de véhicules électriques, PDF avec couche texte, clairement
 * marqués « document fictif de démonstration ». Montants cohérents entre
 * eux (sous-total, TPS 5 %, TVQ 9,975 %, total), déterministes.
 */
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1f2933" },
  titre: { fontSize: 14, marginBottom: 4 },
  bandeau: { fontSize: 8, color: "#b42318", marginBottom: 14 },
  ligne: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#d0d5dd" },
  note: { fontSize: 8, color: "#667085", marginTop: 16 },
});

export const FACTURE_DIESEL_DEMO = {
  nom: "facture-diesel-riviere-claire-fictive.pdf",
  lignes: [
    "Pétroles Rivière-Claire inc. — Facture n° RC-2026-0917 — 2026-09-17",
    "Livraison de diesel au Garage central (Ville de Rivière-Claire)",
  ],
  tableau: [
    ["Diesel", "6 840,0 L    à 1,3980 $/L"],
    ["Sous-total avant taxes", "9 562,32 $"],
    ["TPS (5 %)", "478,12 $"],
    ["TVQ (9,975 %)", "953,84 $"],
    ["Total", "10 994,28 $"],
  ],
};

export const DEVIS_VEHICULE_DEMO = {
  nom: "devis-vehicules-electriques-riviere-claire-fictif.pdf",
  lignes: [
    "Électro-Camions Laurentides — Soumission n° Q-2026-4471 — 2026-09-20",
    "Destinataire : Ville de Rivière-Claire, service des travaux publics",
  ],
  tableau: [
    ["Véhicule", "Ford E-Transit 350 fourgon — 100 % électrique"],
    ["Quantité", "3 véhicules"],
    ["Prix unitaire avant taxes", "74 950,00 $"],
    ["Sous-total avant taxes", "224 850,00 $"],
    ["TPS (5 %)", "11 242,50 $"],
    ["TVQ (9,975 %)", "22 428,79 $"],
    ["Total", "258 521,29 $"],
  ],
};

function PieceFictive({ piece }: { piece: typeof FACTURE_DIESEL_DEMO }) {
  return (
    <Document title={piece.nom}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.titre}>{piece.lignes[0]}</Text>
        <Text style={s.bandeau}>DOCUMENT FICTIF DE DÉMONSTRATION — H2Fleet (Ville de Rivière-Claire, municipalité fictive)</Text>
        {piece.lignes.slice(1).map((l, i) => (
          <Text key={i} style={{ marginBottom: 10 }}>
            {l}
          </Text>
        ))}
        {piece.tableau.map(([a, b]) => (
          <View key={a} style={s.ligne}>
            <Text>{a}</Text>
            <Text>{b}</Text>
          </View>
        ))}
        <Text style={s.note}>
          Conditions : net 30 jours. Ce document n'a aucune valeur commerciale : il sert à montrer la lecture de factures et de devis dans H2Fleet.
        </Text>
      </Page>
    </Document>
  );
}

export async function fichierPieceDemo(type: "fuel_invoice" | "vehicle_quote"): Promise<File> {
  const piece = type === "fuel_invoice" ? FACTURE_DIESEL_DEMO : DEVIS_VEHICULE_DEMO;
  const blob = await pdf(<PieceFictive piece={piece} />).toBlob();
  return new File([blob], piece.nom, { type: "application/pdf" });
}
