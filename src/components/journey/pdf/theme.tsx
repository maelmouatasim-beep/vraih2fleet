/**
 * Phase 5.7 — Gabarit PDF commun des livrables H2Fleet (note au conseil,
 * rapport détaillé), au standard des cabinets de conseil :
 * - la conclusion d'abord (encadré « Recommandation », titres d'action :
 *   la première phrase de chaque section est sa conclusion) ;
 * - pièces NUMÉROTÉES (« Pièce 1 »…) avec leur source sous chaque tableau ;
 * - typographie sobre : titres en Times, texte et tableaux en Helvetica,
 *   une couleur d'accent, filets fins, aucun aplat lourd ;
 * - pied de page de traçabilité (version du moteur, empreinte des entrées).
 */
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { titreEtCorps } from "@/lib/journey/redaction";

export const COULEURS = {
  encre: "#0b1f3a",
  texte: "#1f2933",
  gris: "#5b6472",
  grisClair: "#8a93a0",
  filet: "#d5d9df",
  fond: "#f4f6f9",
  accent: "#0f766e",
  negatif: "#9b1c1c",
};

export const styles = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 54,
    paddingHorizontal: 54,
    fontSize: 9.5,
    lineHeight: 1.45,
    color: COULEURS.texte,
    fontFamily: "Helvetica",
  },
  surtitre: { fontSize: 8, color: COULEURS.accent, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  titre: { fontSize: 21, lineHeight: 1.2, color: COULEURS.encre, fontFamily: "Times-Bold", marginBottom: 6 },
  meta: { fontSize: 8.5, color: COULEURS.gris, marginBottom: 1 },
  filetEpais: { borderBottom: `1.2 solid ${COULEURS.encre}`, marginTop: 10, marginBottom: 14 },
  etiquetteSection: { fontSize: 7.5, color: COULEURS.accent, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 3 },
  titreAction: { fontSize: 12.5, lineHeight: 1.3, color: COULEURS.encre, fontFamily: "Times-Bold", marginBottom: 5 },
  paragraphe: { marginBottom: 5, textAlign: "justify" },
  puce: { flexDirection: "row", marginBottom: 3 },
  puceSigne: { width: 10, color: COULEURS.accent, fontFamily: "Helvetica-Bold" },
  encadre: {
    borderLeft: `3 solid ${COULEURS.encre}`,
    backgroundColor: COULEURS.fond,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  encadreTitre: { fontSize: 7.5, color: COULEURS.encre, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  tuiles: { flexDirection: "row", marginBottom: 14, borderTop: `0.6 solid ${COULEURS.filet}`, borderBottom: `0.6 solid ${COULEURS.filet}` },
  tuile: { flex: 1, paddingVertical: 8, paddingRight: 8 },
  tuileLibelle: { fontSize: 7.5, color: COULEURS.gris, marginBottom: 2 },
  tuileValeur: { fontSize: 14, color: COULEURS.encre, fontFamily: "Times-Bold" },
  piece: { marginTop: 8, marginBottom: 6 },
  pieceNumero: { fontSize: 7.5, color: COULEURS.accent, fontFamily: "Helvetica-Bold" },
  pieceTitre: { fontSize: 10, color: COULEURS.encre, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  pieceSousTitre: { fontSize: 8, color: COULEURS.gris, marginBottom: 4 },
  source: { fontSize: 7, color: COULEURS.grisClair, marginTop: 3, fontFamily: "Helvetica-Oblique" },
  enTeteTable: { flexDirection: "row", borderBottom: `0.9 solid ${COULEURS.encre}`, paddingBottom: 3, marginTop: 2 },
  enTeteCellule: { fontSize: 7.5, color: COULEURS.gris, fontFamily: "Helvetica-Bold", paddingHorizontal: 3 },
  ligne: { flexDirection: "row", borderBottom: `0.4 solid ${COULEURS.filet}`, paddingVertical: 2.5 },
  ligneTotal: { flexDirection: "row", borderTop: `0.9 solid ${COULEURS.encre}`, paddingVertical: 3 },
  cellule: { fontSize: 8.5, paddingHorizontal: 3 },
  droite: { textAlign: "right" },
  note: { fontSize: 7.5, color: COULEURS.gris, lineHeight: 1.4, marginTop: 3 },
  enTetePage: {
    position: "absolute",
    top: 24,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COULEURS.grisClair,
    borderBottom: `0.4 solid ${COULEURS.filet}`,
    paddingBottom: 4,
  },
  piedPage: {
    // Positionné par le HAUT (format Lettre, 792 pt) : `bottom` + numéro de
    // page dynamique fait planter react-pdf au-delà d'une dizaine de pages
    // (« unsupported number », re-audit : rapport à 500+ véhicules).
    position: "absolute",
    top: 792 - 22 - 10,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COULEURS.grisClair,
  },
});

export function EnTetePage({ gauche, droite }: { gauche: string; droite: string }) {
  return (
    <View style={styles.enTetePage} fixed>
      <Text>{gauche}</Text>
      <Text>{droite}</Text>
    </View>
  );
}

export function PiedPage({ gauche, en }: { gauche: string; en: boolean }) {
  return (
    <View style={styles.piedPage} fixed>
      <Text>{gauche}</Text>
      <Text render={({ pageNumber, totalPages }) => `${en ? "Page" : "Page"} ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

/** Paragraphes et puces (« - ») d'un texte libre. */
export function Texte({ texte }: { texte: string }) {
  const blocs = texte.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return (
    <>
      {blocs.map((b, i) =>
        b.startsWith("- ") ? (
          <View key={i} style={styles.puce} wrap={false}>
            <Text style={styles.puceSigne}>–</Text>
            <Text style={{ flex: 1 }}>{b.slice(2)}</Text>
          </View>
        ) : (
          <Text key={i} style={styles.paragraphe}>
            {b}
          </Text>
        ),
      )}
    </>
  );
}

export function Section({ etiquette, texte, children }: { etiquette: string; texte?: string; children?: ReactNode }) {
  const { titre, corps } = titreEtCorps(texte ?? "");
  return (
    <View>
      <View wrap={false}>
        <Text style={styles.etiquetteSection}>{etiquette.toLocaleUpperCase()}</Text>
        {titre ? <Text style={styles.titreAction}>{titre}</Text> : null}
      </View>
      {corps ? <Texte texte={corps} /> : null}
      {children}
    </View>
  );
}

export interface Colonne {
  titre: string;
  flex: number;
  droite?: boolean;
  /** Retrait à gauche (pt), pour séparer une colonne de texte d'une colonne de nombres. */
  retrait?: number;
}

export function Tableau({
  colonnes,
  lignes,
  total,
  negatifs,
}: {
  colonnes: Colonne[];
  lignes: string[][];
  total?: string[];
  /** Indices de cellules à colorer quand la valeur commence par « - » ou « −». */
  negatifs?: boolean;
}) {
  const cellule = (v: string, c: Colonne, j: number, gras = false) => (
    <Text
      key={j}
      style={[
        styles.cellule,
        { flex: c.flex },
        c.retrait ? { paddingLeft: c.retrait } : {},
        c.droite ? styles.droite : {},
        gras ? { fontFamily: "Helvetica-Bold" } : {},
        negatifs && c.droite && /^[-−]/.test(v) ? { color: COULEURS.negatif } : {},
      ]}
    >
      {v}
    </Text>
  );
  return (
    <View>
      {/* Entête répétée sur chaque page où le tableau se poursuit ; jamais seule en bas de page. */}
      <View style={styles.enTeteTable} wrap={false} fixed minPresenceAhead={30}>
        {colonnes.map((c, j) => (
          <Text key={j} style={[styles.enTeteCellule, { flex: c.flex }, c.retrait ? { paddingLeft: c.retrait } : {}, c.droite ? styles.droite : {}]}>
            {c.titre}
          </Text>
        ))}
      </View>
      {lignes.map((l, i) => (
        <View key={i} style={styles.ligne} wrap={false}>
          {l.map((v, j) => cellule(v, colonnes[j], j))}
        </View>
      ))}
      {total && (
        <View style={styles.ligneTotal} wrap={false}>
          {total.map((v, j) => cellule(v, colonnes[j], j, true))}
        </View>
      )}
    </View>
  );
}

export function Piece({
  numero,
  titre,
  sousTitre,
  source,
  children,
}: {
  numero: string;
  titre: string;
  sousTitre?: string;
  source: string;
  children: ReactNode;
}) {
  // Une pièce longue (tableau de centaines de véhicules) se POURSUIT sur la
  // page suivante : la rendre insécable la ferait écraser sur une seule page
  // (texte superposé). Seul son titre reste solidaire du début du contenu.
  return (
    <View style={styles.piece}>
      <View wrap={false} minPresenceAhead={60}>
        <Text style={styles.pieceNumero}>{numero.toLocaleUpperCase()}</Text>
        <Text style={styles.pieceTitre}>{titre}</Text>
        {sousTitre ? <Text style={styles.pieceSousTitre}>{sousTitre}</Text> : null}
      </View>
      {children}
      <Text style={styles.source} minPresenceAhead={0}>
        {source}
      </Text>
    </View>
  );
}

export function Tuiles({ tuiles }: { tuiles: { libelle: string; valeur: string; negatif?: boolean; note?: string }[] }) {
  return (
    <View style={styles.tuiles} wrap={false}>
      {tuiles.map((t, i) => (
        <View key={i} style={styles.tuile}>
          <Text style={styles.tuileLibelle}>{t.libelle}</Text>
          <Text style={[styles.tuileValeur, t.negatif ? { color: COULEURS.negatif } : {}]}>{t.valeur}</Text>
          {t.note ? <Text style={[styles.note, { marginTop: 1 }]}>{t.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function Encadre({ titre, texte }: { titre: string; texte: string }) {
  return (
    <View style={styles.encadre} wrap={false}>
      <Text style={styles.encadreTitre}>{titre.toLocaleUpperCase()}</Text>
      <Texte texte={texte} />
    </View>
  );
}
