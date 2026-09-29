/**
 * Étape 5 — Financement : logique PURE du suivi des demandes de
 * subvention (C5). L'échéance d'une demande vient d'abord de la tâche
 * générée du plan (auto_key subvention:<vehicule>:<programme>), sinon de
 * la date de fin du programme du registre.
 */
import { PROGRAMMES } from "@/lib/tco";

export const STATUTS_DEMANDE = ["a_preparer", "deposee", "accordee", "recue"] as const;
export type StatutDemande = (typeof STATUTS_DEMANDE)[number];

export interface DemandeSubvention {
  id: string;
  program_id: string;
  label: string | null;
  vehicle_id: string | null;
  status: StatutDemande;
}

export interface TacheSubvention {
  subsidy_program: string | null;
  vehicle_id: string | null;
  due_date: string | null;
}

export interface EcheanceDemande {
  date: string | null;
  source: "tache" | "programme" | null;
}

/** Nom court d'un programme du registre (avant le tiret), ou le libellé libre. */
export function nomProgramme(programId: string, label: string | null): string {
  if (programId === "autre") return label ?? "Autre";
  const prog = PROGRAMMES.find((p) => p.id === programId);
  return prog ? prog.nom.split("—")[0].trim() : label ?? programId;
}

/**
 * Échéance de chaque demande :
 * 1. la tâche du plan pour le MÊME programme (et le même véhicule quand
 *    la demande en vise un) ;
 * 2. sinon la date de fin du programme du registre ;
 * 3. sinon aucune échéance connue.
 */
export function echeancesDemandes(
  demandes: DemandeSubvention[],
  taches: TacheSubvention[],
): Map<string, EcheanceDemande> {
  const resultat = new Map<string, EcheanceDemande>();
  for (const d of demandes) {
    const candidates = taches.filter(
      (t) =>
        t.subsidy_program === d.program_id &&
        t.due_date != null &&
        (d.vehicle_id == null || t.vehicle_id === d.vehicle_id),
    );
    if (candidates.length > 0) {
      const date = candidates.map((t) => t.due_date!).sort()[0];
      resultat.set(d.id, { date, source: "tache" });
      continue;
    }
    const prog = PROGRAMMES.find((p) => p.id === d.program_id);
    if (prog?.dateFin) {
      resultat.set(d.id, { date: prog.dateFin, source: "programme" });
    } else {
      resultat.set(d.id, { date: null, source: null });
    }
  }
  return resultat;
}
