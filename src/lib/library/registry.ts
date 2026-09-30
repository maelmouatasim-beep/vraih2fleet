/**
 * D2 — Bibliothèque = registre COMPLET de ce que le moteur utilise
 * réellement : hypothèses (valeur, plage, statut, source, date),
 * programmes de subvention (statut calculé) et historique des prix
 * collectés. Fonctions PURES (testées).
 */
import energyData from "@/lib/tco/energy-data.json";
import type { Hypothese, StatutHypothese } from "@/lib/tco";

export interface ResumeStatuts {
  total: number;
  verifie: number;
  estimation: number;
  a_valider: number;
}

export function resumeStatuts(hypotheses: Pick<Hypothese, "statut">[]): ResumeStatuts {
  const compte = (s: StatutHypothese) => hypotheses.filter((h) => h.statut === s).length;
  return {
    total: hypotheses.length,
    verifie: compte("verifie"),
    estimation: compte("estimation"),
    a_valider: compte("a_valider"),
  };
}

/** Valeur lisible : ratios en %, montants en $ CAD, sinon nombre + unité. */
export function formaterValeur(valeur: number, unite: string, langue: string): string {
  const locale = langue === "en" ? "en-CA" : "fr-CA";
  if (unite === "ratio") {
    return `${(valeur * 100).toLocaleString(locale, { maximumFractionDigits: 2 })} %`;
  }
  if (unite === "$") {
    return valeur.toLocaleString(locale, { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  }
  return `${valeur.toLocaleString(locale, { maximumFractionDigits: 4 })} ${unite}`;
}

/** Filtre texte + statut (insensible à la casse et aux accents). */
export function filtrerHypotheses<T extends Pick<Hypothese, "id" | "description" | "statut">>(
  hypotheses: T[],
  recherche: string,
  statut: StatutHypothese | "tous",
): T[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(recherche.trim());
  return hypotheses.filter(
    (h) =>
      (statut === "tous" || h.statut === statut) &&
      (q === "" || norm(h.id).includes(q) || norm(h.description).includes(q)),
  );
}

export interface PointHistorique {
  mois: string;
  quebec: number;
  montreal: number;
}

/** Historique mensuel du diesel collecté (¢/L TTC), tel qu'archivé par
 *  le workflow hebdomadaire — jamais complété ni extrapolé. */
export function historiqueDiesel(): {
  points: PointHistorique[];
  source: { organisme: string; url: string; archive: string };
  dateVerification: string;
  versionDonnees: string;
} {
  const d = energyData.diesel;
  const points = d.mois.map((mois, i) => ({
    mois,
    quebec: d.serieTtcCentsParL.quebec[i],
    montreal: d.serieTtcCentsParL.montreal[i],
  }));
  return {
    points,
    source: { organisme: d.source.organisme, url: d.source.url, archive: d.source.archive },
    dateVerification: d.dateVerification,
    versionDonnees: energyData.versionDonnees,
  };
}
