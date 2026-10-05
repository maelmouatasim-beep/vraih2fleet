/**
 * Annexes du rapport pour le trésorier (point 12 de l'audit) — logique
 * PURE partagée par le PDF et l'Excel :
 * - chaque hypothèse renvoie à une source NUMÉROTÉE, listée avec son URL ;
 * - prix d'achat avant taxes par catégorie et par technologie, avec plage ;
 * - les URL longues sont rendues sécables (sans changer le lien).
 */
import { DEFAUTS_CATEGORIES, type CategorieVehicule, type Hypothese } from "@/lib/tco";
import { sourcesCategorie } from "@/lib/library/liens";

type Langue = "fr" | "en";

export interface SourceNumerotee {
  numero: number;
  organisme: string;
  document: string;
  annee: number | null;
  url: string | null;
  /** Vrai si la source n'a pas encore été lue (statut « à valider »). */
  aValider: boolean;
}

export interface RegistreSources {
  /** Numéro de source de chaque hypothèse. */
  parHypothese: Map<string, number>;
  /** Numéros des sources de chaque catégorie (prix, consommation, entretien). */
  parCategorie: Map<CategorieVehicule, number[]>;
  sources: SourceNumerotee[];
}

/** Numérote les sources une seule fois (même organisme, document et URL = même numéro). */
export function numeroterSources(hypotheses: Hypothese[]): RegistreSources {
  const sources: SourceNumerotee[] = [];
  const index = new Map<string, number>();
  const numero = (s: Omit<SourceNumerotee, "numero">): number => {
    const cle = `${s.organisme}|${s.document}|${s.url ?? ""}`;
    const existant = index.get(cle);
    if (existant) {
      // Une source est « à valider » seulement si aucune hypothèse ne l'a lue.
      if (!s.aValider) sources[existant - 1].aValider = false;
      return existant;
    }
    const n = sources.length + 1;
    sources.push({ numero: n, ...s });
    index.set(cle, n);
    return n;
  };
  const parHypothese = new Map<string, number>();
  for (const h of hypotheses) {
    parHypothese.set(
      h.id,
      numero({
        organisme: h.source.organisme,
        document: h.source.tableauOuPage ? `${h.source.document}, ${h.source.tableauOuPage}` : h.source.document,
        annee: h.source.annee,
        url: h.source.url || null,
        aValider: h.statut !== "verifie",
      }),
    );
  }
  const parCategorie = new Map<CategorieVehicule, number[]>();
  for (const cat of Object.keys(DEFAUTS_CATEGORIES) as CategorieVehicule[]) {
    parCategorie.set(
      cat,
      sourcesCategorie(cat).map((s) => numero({ organisme: s.texte, document: "", annee: null, url: s.url, aValider: s.aValider })),
    );
  }
  return { parHypothese, parCategorie, sources };
}

/** « [3] » ou « [3, 4] ». */
export const renvoiSource = (n: number | number[]): string => `[${(Array.isArray(n) ? n : [n]).join(", ")}]`;

/** Ligne de la liste des sources (sans l'URL, rendue à part). */
export function ligneSource(s: SourceNumerotee, langue: Langue): string {
  const morceaux = [s.organisme, s.document, s.annee != null ? String(s.annee) : ""].filter((x) => x && x.trim());
  const statut = s.aValider ? (langue === "en" ? " — to be validated" : " — à valider") : "";
  return `${renvoiSource(s.numero)} ${morceaux.join(" — ")}${statut}`;
}

/** Insère des points de coupure invisibles après / ? & = - _ . pour qu'une URL longue passe à la ligne. */
export function urlSecable(url: string): string {
  return url.replace(/([/?&=_.-])/g, "$1\u200b");
}

export interface LignePrixCategorie {
  categorie: CategorieVehicule;
  libelle: string;
  /** Prix avant taxes, CAD 2026 : valeur et plage, par technologie. */
  prix: Record<"diesel" | "BEV" | "FCEV", { valeur: number; basse: number; haute: number }>;
  dureeVieAns: number;
  sources: number[];
}

/** `libelle` : libellé de la catégorie dans la langue du rapport (report.ts › libelleCategorie). */
export function prixParCategorie(registre: RegistreSources, libelle: (c: CategorieVehicule) => string): LignePrixCategorie[] {
  return (Object.keys(DEFAUTS_CATEGORIES) as CategorieVehicule[]).map((cat) => {
    const d = DEFAUTS_CATEGORIES[cat];
    const p = (tech: "diesel" | "BEV" | "FCEV") => ({
      valeur: d.prixAchat[tech].valeur,
      basse: d.prixAchat[tech].plage.basse,
      haute: d.prixAchat[tech].plage.haute,
    });
    return {
      categorie: cat,
      libelle: libelle(cat),
      prix: { diesel: p("diesel"), BEV: p("BEV"), FCEV: p("FCEV") },
      dureeVieAns: d.dureeVieAns,
      sources: registre.parCategorie.get(cat) ?? [],
    };
  });
}
