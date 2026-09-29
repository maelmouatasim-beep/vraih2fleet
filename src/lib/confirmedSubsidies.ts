/**
 * Subventions CONFIRMÉES par le client (module PUR — pas de client
 * Supabase ici) : montants réels confirmés par un document (lettre
 * d'octroi, décision) pour les programmes non chiffrables
 * automatiquement (PAGTCP, FTCZE, % Écocamionnage classes 5-8 à
 * valider…). PRIORITÉ AU CLIENT : une confirmation remplace la
 * subvention résolue automatiquement du même programme pour ce
 * véhicule ; les autres s'ajoutent. Le libellé porte toujours
 * « confirmée par le client (réf. …) » — repris tel quel au
 * Financement, dans le PDF et dans le classeur Excel.
 */
import { PROGRAMMES } from "@/lib/tco";

export interface SubventionConfirmee {
  /** id du registre (pagtcp, ftcze, ecocamionnage_v1…) ou 'autre'. */
  programId: string;
  /** Libellé court à afficher (nom du programme, ou libellé libre). */
  libelle: string;
  montant: number;
  /** Année CALENDAIRE de versement ; null = année d'achat du véhicule. */
  anneeCalendaireVersement: number | null;
  /** Référence du document qui confirme le montant (obligatoire). */
  reference: string;
}

/** Ligne minimale de la table confirmed_subsidies (structurel). */
export interface LigneSubventionConfirmee {
  vehicle_id: string;
  program_id: string;
  label: string | null;
  amount: number;
  payment_year: number | null;
  document_reference: string;
}

/** Nom court d'un programme du registre (avant le tiret long), ou le
 *  libellé libre pour 'autre'. */
export function libelleCourtProgramme(programId: string, label: string | null): string {
  const prog = PROGRAMMES.find((p) => p.id === programId);
  if (prog) return prog.nom.split("—")[0].trim();
  return label?.trim() || programId;
}

/** Regroupe les lignes de la table par véhicule, prêtes pour le moteur. */
export function parVehicule(lignes: LigneSubventionConfirmee[]): Map<string, SubventionConfirmee[]> {
  const map = new Map<string, SubventionConfirmee[]>();
  for (const l of lignes) {
    const liste = map.get(l.vehicle_id) ?? [];
    liste.push({
      programId: l.program_id,
      libelle: libelleCourtProgramme(l.program_id, l.label),
      montant: l.amount,
      anneeCalendaireVersement: l.payment_year,
      reference: l.document_reference,
    });
    map.set(l.vehicle_id, liste);
  }
  return map;
}

/**
 * Applique les confirmations du client aux subventions résolues d'un
 * véhicule (les années des résolues sont déjà ABSOLUES dans le plan) :
 * - une confirmation d'un programme du registre REMPLACE la subvention
 *   résolue de ce programme ;
 * - les autres s'AJOUTENT (jamais plafonnées : ce sont des montants
 *   réellement accordés) ;
 * - année de versement : l'année calendaire confirmée (jamais avant
 *   l'année d'achat k), sinon k.
 */
export function appliquerSubventionsConfirmees(
  resolues: { libelle: string; montant: number; annee: number }[],
  confirmees: SubventionConfirmee[] | undefined,
  k: number,
  anneeReference: number,
): { libelle: string; montant: number; annee: number }[] {
  if (!confirmees || confirmees.length === 0) return resolues;
  let subventions = [...resolues];
  for (const c of confirmees) {
    const prog = PROGRAMMES.find((p) => p.id === c.programId);
    if (prog) subventions = subventions.filter((s) => s.libelle !== prog.nom);
    const annee =
      c.anneeCalendaireVersement != null
        ? Math.max(c.anneeCalendaireVersement - anneeReference, k)
        : k;
    subventions.push({
      libelle: `${c.libelle} — confirmée par le client (réf. ${c.reference})`,
      montant: c.montant,
      annee,
    });
  }
  return subventions;
}
