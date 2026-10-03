/**
 * Phase 5.7 — NOTE AU CONSEIL au format Word (.docx), même structure et
 * même sobriété que le PDF : recommandation encadrée, chiffres clés,
 * sections à titre d'action, pièces numérotées et sourcées, limites,
 * annexe de traçabilité. Module chargé à la demande (bibliothèque docx).
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ResultatSensibilite } from "@/lib/tco";
import type { StrategieConstruite } from "./strategies";
import type { FaitNote, SectionsNote } from "./councilNote";
import { titreEtCorps } from "./redaction";

export interface MetaNoteDocx {
  organisation: string;
  projet: string;
  dateIso: string;
  strategie: string;
  snapshotDate: string;
  moteur: string;
  empreinte: string;
}

const ENCRE = "0B1F3A";
const ACCENT = "0F766E";
const GRIS = "5B6472";
const FILET = "D5D9DF";
const POLICE_TITRE = "Georgia";
const POLICE = "Calibri";

const p = (texte: string, o: { gras?: boolean; taille?: number; couleur?: string; police?: string; apres?: number; italique?: boolean } = {}) =>
  new Paragraph({
    spacing: { after: o.apres ?? 100 },
    children: [
      new TextRun({ text: texte, bold: o.gras, size: o.taille ?? 20, color: o.couleur, font: o.police ?? POLICE, italics: o.italique }),
    ],
  });

function texte(t: string): Paragraph[] {
  return t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) =>
      l.startsWith("- ")
        ? new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: l.slice(2), size: 20, font: POLICE })] })
        : new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 }, children: [new TextRun({ text: l, size: 20, font: POLICE })] }),
    );
}

function section(etiquette: string, contenu: string): Paragraph[] {
  const { titre, corps } = titreEtCorps(contenu);
  return [
    p(etiquette.toLocaleUpperCase(), { gras: true, taille: 15, couleur: ACCENT, apres: 40 }),
    ...(titre ? [p(titre, { gras: true, taille: 25, couleur: ENCRE, police: POLICE_TITRE, apres: 80 })] : []),
    ...texte(corps),
  ];
}

const bordures = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: FILET },
};

function tableau(entetes: string[], lignes: string[][], total?: string[], largeurs?: number[]): Table {
  const w = largeurs ?? entetes.map(() => Math.floor(100 / entetes.length));
  const cellule = (v: string, j: number, o: { gras?: boolean; entete?: boolean } = {}) =>
    new TableCell({
      width: { size: w[j], type: WidthType.PERCENTAGE },
      borders: o.entete ? { ...bordures, bottom: { style: BorderStyle.SINGLE, size: 10, color: ENCRE } } : bordures,
      children: [
        new Paragraph({
          alignment: j > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [new TextRun({ text: v, bold: o.gras || o.entete, size: o.entete ? 16 : 18, color: o.entete ? GRIS : undefined, font: POLICE })],
        }),
      ],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: entetes.map((e, j) => cellule(e, j, { entete: true })) }),
      ...lignes.map((l) => new TableRow({ children: l.map((v, j) => cellule(v, j)) })),
      ...(total ? [new TableRow({ children: total.map((v, j) => cellule(v, j, { gras: true })) })] : []),
    ],
  });
}

function piece(numero: string, titre: string, sousTitre: string | null, t: Table, source: string) {
  return [
    p(numero.toLocaleUpperCase(), { gras: true, taille: 15, couleur: ACCENT, apres: 20 }),
    p(titre, { gras: true, taille: 20, couleur: ENCRE, apres: 20 }),
    ...(sousTitre ? [p(sousTitre, { taille: 16, couleur: GRIS, apres: 60 })] : []),
    t,
    p(source, { taille: 14, couleur: GRIS, italique: true, apres: 200 }),
  ];
}

export async function construireNoteDocx(o: {
  langue: "fr" | "en";
  sections: SectionsNote;
  faits: FaitNote[];
  meta: MetaNoteDocx;
  strategie: StrategieConstruite;
  sensibilite: ResultatSensibilite;
}): Promise<Blob> {
  const en = o.langue === "en";
  const r = o.strategie.resultat!;
  const fait = (id: string) => o.faits.find((f) => f.id === id)?.rendu[o.langue] ?? "—";
  const cad = (v: number) =>
    new Intl.NumberFormat(en ? "en-CA" : "fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);
  const source = en
    ? `Source: H2Fleet engine ${o.meta.moteur}, input fingerprint ${o.meta.empreinte}, plan frozen on ${o.meta.snapshotDate}.`
    : `Source : moteur H2Fleet ${o.meta.moteur}, empreinte des entrées ${o.meta.empreinte}, plan figé le ${o.meta.snapshotDate}.`;
  let n = 0;
  const numero = () => `${en ? "Exhibit" : "Pièce"} ${++n}`;
  const budget = r.vueBudgetaire.filter((l) => l.investissementAlt || l.subventionsAlt);

  const recommandation = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, color: "auto", fill: "F4F6F9" },
            borders: { ...bordures, bottom: bordures.top, left: { style: BorderStyle.SINGLE, size: 24, color: ENCRE } },
            margins: { top: 110, bottom: 110, left: 200, right: 200 },
            children: [p(en ? "RECOMMENDATION" : "RECOMMANDATION", { gras: true, taille: 15, couleur: ENCRE, apres: 60 }), ...texte(o.sections.recommandation)],
          }),
        ],
      }),
    ],
  });

  const enfants = [
    p(en ? "NOTE TO COUNCIL — DECISION MEMO" : "NOTE AU CONSEIL — SOMMAIRE DÉCISIONNEL", { gras: true, taille: 16, couleur: ACCENT, apres: 80 }),
    p(en ? `Fleet replacement plan: ${o.meta.projet}` : `Plan de remplacement de la flotte : ${o.meta.projet}`, {
      gras: true,
      taille: 40,
      couleur: ENCRE,
      police: POLICE_TITRE,
      apres: 80,
    }),
    p(`${o.meta.organisation} · ${o.meta.dateIso} · ${en ? "Selected strategy: " : "Stratégie retenue : "}${o.meta.strategie}`, {
      taille: 17,
      couleur: GRIS,
      apres: 200,
    }),
    tableau(
      [
        en ? "Savings vs status quo (NPV)" : "Économie vs statu quo (VAN)",
        en ? "Total investment" : "Investissement total",
        en ? "Expected subsidies" : "Subventions prévues",
        en ? "Winning scenarios" : "Scénarios gagnants",
      ],
      [[fait("van_centrale"), fait("investissement_total"), fait("subventions_total"), `${fait("scenarios_gagnants")} / ${fait("nb_scenarios")}`]],
      undefined,
      [25, 25, 25, 25],
    ),
    p("", { apres: 160 }),
    recommandation,
    p("", { apres: 110 }),
    ...section(en ? "1 · Context" : "1 · Contexte", o.sections.contexte),
    ...section(en ? "2 · Costs and benefits" : "2 · Coûts et bénéfices", o.sections.couts),
    ...piece(
      numero(),
      en ? "Discounted cost of the plan against the status quo" : "Coût actualisé du plan comparé au statu quo",
      en ? `Over ${fait("horizon_ans")}, discounted at ${fait("taux_actualisation")}` : `Sur ${fait("horizon_ans")}, actualisé à ${fait("taux_actualisation")}`,
      tableau(
        [en ? "Indicator" : "Indicateur", en ? "Value" : "Valeur"],
        [
          [en ? "Discounted total cost — plan" : "Coût total actualisé — plan", fait("tco_plan")],
          [en ? "Discounted total cost — status quo" : "Coût total actualisé — statu quo", fait("tco_statu_quo")],
          [en ? "Discounted payback" : "Récupération actualisée", fait("recuperation")],
          [en ? "CO2e avoided — full cycle" : "CO2e évité — cycle complet", fait("co2_evite_t")],
        ],
        [en ? "Savings vs status quo (NPV)" : "Économie vs statu quo (VAN)", fait("van_centrale")],
        [70, 30],
      ),
      source,
    ),
    ...section(en ? "3 · Financing" : "3 · Financement", o.sections.financement),
    ...(budget.length > 0
      ? piece(
          numero(),
          en ? "Investment schedule and amount to finance" : "Calendrier d'investissement et reste à financer",
          en ? "Current dollars" : "Dollars courants",
          tableau(
            [en ? "Year" : "Année", en ? "Investment" : "Investissement", en ? "Subsidies" : "Subventions", en ? "To finance" : "Reste à financer"],
            budget.map((l) => [String(l.annee), cad(l.investissementAlt), l.subventionsAlt ? cad(l.subventionsAlt) : "—", cad(l.resteAFinancerAlt)]),
            ["Total", fait("investissement_total"), fait("subventions_total"), fait("reste_a_financer")],
            [16, 28, 28, 28],
          ),
          source,
        )
      : []),
    ...section(en ? "4 · Risks and stress test" : "4 · Risques et stress test", o.sections.risques),
    ...piece(
      numero(),
      en ? "Savings under three scenarios" : "Économie selon trois scénarios",
      en ? "Each scenario re-runs the full engine at the sourced bounds of every assumption" : "Chaque scénario relance le moteur complet aux bornes sourcées de chaque hypothèse",
      tableau(
        [en ? "Scenario" : "Scénario", en ? "Savings (NPV)" : "Économie (VAN)"],
        [
          [en ? "Cautious" : "Prudent", cad(o.sensibilite.scenarios.prudent.van)],
          ["Central", cad(o.sensibilite.scenarios.central.van)],
          [en ? "Favourable" : "Favorable", cad(o.sensibilite.scenarios.favorable.van)],
        ],
        undefined,
        [70, 30],
      ),
      source,
    ),
    ...section(en ? "5 · Winter operation" : "5 · Exploitation hivernale", o.sections.hiver),
    ...section(en ? "6 · Next steps" : "6 · Prochaines étapes", o.sections.prochaines_etapes),
    p(en ? "APPENDIX — TRACEABILITY OF FIGURES" : "ANNEXE — TRAÇABILITÉ DES CHIFFRES", { gras: true, taille: 15, couleur: ACCENT, apres: 40 }),
    p(en ? "Every figure in this note is an engine output" : "Chaque chiffre de cette note est une sortie du moteur", {
      gras: true,
      taille: 25,
      couleur: ENCRE,
      police: POLICE_TITRE,
      apres: 80,
    }),
    tableau(
      [en ? "Fact" : "Fait", en ? "Value" : "Valeur", "Source"],
      o.faits.filter((f) => !["organisation", "projet", "empreinte"].includes(f.id)).map((f) => [f.libelle[o.langue], f.rendu[o.langue], f.source[o.langue]]),
      undefined,
      [44, 34, 22],
    ),
  ];

  const doc = new Document({
    creator: "H2Fleet",
    title: en ? `Note to council — ${o.meta.projet}` : `Note au conseil — ${o.meta.projet}`,
    styles: { default: { document: { run: { font: POLICE, size: 20 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
        headers: {
          default: new Header({ children: [p(`${o.meta.organisation} — ${en ? "Note to council" : "Note au conseil"} — ${o.meta.dateIso}`, { taille: 14, couleur: GRIS })] }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `H2Fleet ${o.meta.moteur} · ${en ? "fingerprint" : "empreinte"} ${o.meta.empreinte} · page `, size: 14, color: GRIS, font: POLICE }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: GRIS, font: POLICE }),
                ],
              }),
            ],
          }),
        },
        children: enfants,
      },
    ],
  });
  return Packer.toBlob(doc);
}
