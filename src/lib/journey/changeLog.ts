/**
 * Journal des actions — modèle PUR (testable sans client Supabase) :
 * structure d'une entrée et construction de l'aperçu avant → après.
 */
export type SourceJournal = "strategie" | "optimiseur" | "copilote" | "import" | "document" | "veille" | "manuel";

export interface ChangementJournal {
  /** Ce qui change : véhicule (unité ou id), garage, hypothèse… */
  cible: string;
  champ: string;
  avant: string | number | null;
  apres: string | number | null;
}

export interface EntreeJournal {
  organizationId: string;
  projectId?: string | null;
  source: SourceJournal;
  action: string;
  resume?: string;
  changements: ChangementJournal[];
}

/** Aperçu avant → après d'un changement année + cible de véhicules. */
export function changementsVehicules(
  lignes: {
    unite: string;
    anneeAvant?: number | null;
    anneeApres?: number | null;
    cibleAvant?: string | null;
    cibleApres?: string | null;
  }[],
): ChangementJournal[] {
  const out: ChangementJournal[] = [];
  for (const l of lignes) {
    if (l.anneeApres !== undefined && l.anneeAvant !== l.anneeApres) {
      out.push({ cible: l.unite, champ: "replacement_year", avant: l.anneeAvant ?? null, apres: l.anneeApres ?? null });
    }
    if (l.cibleApres !== undefined && (l.cibleAvant ?? null) !== (l.cibleApres ?? null)) {
      out.push({ cible: l.unite, champ: "target_technology", avant: l.cibleAvant ?? null, apres: l.cibleApres ?? null });
    }
  }
  return out;
}
