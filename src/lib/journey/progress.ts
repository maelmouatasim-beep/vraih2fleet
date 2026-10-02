/**
 * Test terrain, bloc 3.2 — état RÉEL des 7 étapes du parcours (terminé /
 * en cours / à faire) et ce qui manque, calculé à partir des données du
 * projet (jamais à partir de la position de l'étape affichée). PUR.
 */
import type { EtapeParcoursCle } from "./steps";

export type EtatEtape = "termine" | "en_cours" | "a_faire";

/** Ce qui manque : clé i18n journey.progress.missing.<cle> + paramètres. */
export interface Manque {
  cle:
    | "aucunVehicule"
    | "sansAnnee"
    | "sansCible"
    | "aucuneStrategie"
    | "planVide"
    | "demandesManquantes"
    | "aucunRapport"
    | "rapportPerime"
    | "remplacementsRestants";
  count?: number;
}

export interface EtatParcours {
  etat: EtatEtape;
  manques: Manque[];
}

export interface DonneesParcours {
  nbVehicules: number;
  nbSansAnnee: number;
  nbSansCible: number;
  strategieAppliquee: boolean;
  /** Véhicules à remplacer par un véhicule zéro émission (cible BEV/FCEV). */
  nbZeroEmission: number;
  /** Programmes de subvention prévus par le plan (montant > 0). */
  programmesPrevus: string[];
  /** Programmes pour lesquels une demande est suivie. */
  programmesDemandes: string[];
  rapportGenere: boolean;
  /** null tant qu'aucun rapport n'existe. */
  rapportAJour: boolean | null;
  nbRealises: number;
}

export function etatDuParcours(d: DonneesParcours): Record<EtapeParcoursCle, EtatParcours> {
  const flotte: EtatParcours =
    d.nbVehicules === 0
      ? { etat: "a_faire", manques: [{ cle: "aucunVehicule" }] }
      : d.nbSansAnnee > 0
        ? { etat: "en_cours", manques: [{ cle: "sansAnnee", count: d.nbSansAnnee }] }
        : { etat: "termine", manques: [] };

  const faisabilite: EtatParcours =
    d.nbVehicules === 0
      ? { etat: "a_faire", manques: [{ cle: "aucunVehicule" }] }
      : d.nbSansCible === d.nbVehicules
        ? { etat: "a_faire", manques: [{ cle: "sansCible", count: d.nbSansCible }] }
        : d.nbSansCible > 0
          ? { etat: "en_cours", manques: [{ cle: "sansCible", count: d.nbSansCible }] }
          : { etat: "termine", manques: [] };

  const strategies: EtatParcours = d.strategieAppliquee
    ? { etat: "termine", manques: [] }
    : { etat: "a_faire", manques: [d.nbVehicules === 0 ? { cle: "aucunVehicule" } : { cle: "aucuneStrategie" }] };

  const plan: EtatParcours =
    d.nbZeroEmission === 0
      ? { etat: "a_faire", manques: [{ cle: "planVide" }] }
      : d.nbSansAnnee > 0
        ? { etat: "en_cours", manques: [{ cle: "sansAnnee", count: d.nbSansAnnee }] }
        : { etat: "termine", manques: [] };

  const demandes = new Set(d.programmesDemandes);
  const manquantes = [...new Set(d.programmesPrevus)].filter((p) => !demandes.has(p));
  const financement: EtatParcours =
    d.nbZeroEmission === 0
      ? { etat: "a_faire", manques: [{ cle: "planVide" }] }
      : manquantes.length === 0
        ? { etat: "termine", manques: [] }
        : manquantes.length === new Set(d.programmesPrevus).size
          ? { etat: "a_faire", manques: [{ cle: "demandesManquantes", count: manquantes.length }] }
          : { etat: "en_cours", manques: [{ cle: "demandesManquantes", count: manquantes.length }] };

  const rapports: EtatParcours = !d.rapportGenere
    ? { etat: "a_faire", manques: [{ cle: "aucunRapport" }] }
    : d.rapportAJour === false
      ? { etat: "en_cours", manques: [{ cle: "rapportPerime" }] }
      : { etat: "termine", manques: [] };

  const restants = Math.max(0, d.nbZeroEmission - d.nbRealises);
  const suivi: EtatParcours =
    d.nbZeroEmission === 0
      ? { etat: "a_faire", manques: [{ cle: "planVide" }] }
      : restants === 0
        ? { etat: "termine", manques: [] }
        : {
            etat: d.nbRealises > 0 ? "en_cours" : "a_faire",
            manques: [{ cle: "remplacementsRestants", count: restants }],
          };

  return { flotte, faisabilite, strategies, plan, financement, rapports, suivi };
}
