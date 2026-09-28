/**
 * Étape 7 du parcours — Suivi : logique PURE du réalisé vs prévu et de
 * la génération des tâches du plan (idempotente via auto_key).
 */
import { PROGRAMMES, resoudreSubventionsVehicule, statutEffectif, type OptionsParametres } from "@/lib/tco";
import { analyserDonneesVehicule, type VehiculeFaisabilite } from "./feasibility";

export interface VehiculeSuivi extends VehiculeFaisabilite {
  model_year: number | null;
  unit_number: string;
  replacement_year: number | null;
  target_technology: string | null; // 'diesel' | 'bev' | 'fcev' | null
}

export type EtatRemplacement = "realise" | "en_retard" | "cette_annee" | "a_venir" | "sans_plan";

/**
 * État d'un véhicule du plan. « Réalisé » est une heuristique honnête :
 * la technologie actuelle du véhicule correspond à la cible zéro
 * émission, ou (cible diesel) l'année-modèle atteint l'année prévue.
 */
export function etatRemplacement(v: VehiculeSuivi, anneeCourante: number): EtatRemplacement {
  if (v.replacement_year == null || !v.target_technology) return "sans_plan";
  const cible = v.target_technology;
  const realise =
    cible === "diesel"
      ? v.model_year != null && v.model_year >= v.replacement_year
      : v.fuel_type === cible;
  if (realise) return "realise";
  if (v.replacement_year < anneeCourante) return "en_retard";
  if (v.replacement_year === anneeCourante) return "cette_annee";
  return "a_venir";
}

export interface TacheAuto {
  auto_key: string;
  title: string;
  due_date: string; // AAAA-MM-JJ
  vehicle_id: string;
  plan_year: number | null;
  subsidy_program: string | null;
}

const LIBELLES_TECHNO: Record<string, string> = { bev: "BEV", fcev: "FCEV", diesel: "diesel" };

/**
 * Tâches auto-créées depuis les échéances du plan :
 * - remplacement : échéance au 31 mars de l'année prévue (préparation
 *   de l'appel d'offres/PTI — modifiable après création) ;
 * - subvention : une tâche de dépôt de demande par programme retenu,
 *   échéance à la date de fin du programme (ou au 31 mars de l'année
 *   d'achat si le programme n'affiche pas de date de fin).
 * Idempotent : la clé auto_key évite tout doublon à la regénération.
 */
export function tachesDuPlan(
  vehicules: VehiculeSuivi[],
  options: OptionsParametres,
): TacheAuto[] {
  const taches: TacheAuto[] = [];
  for (const v of vehicules) {
    if (v.replacement_year == null || !v.target_technology) continue;
    if (etatRemplacement(v, options.anneeReference) === "realise") continue;
    const techno = LIBELLES_TECHNO[v.target_technology] ?? v.target_technology;
    taches.push({
      auto_key: `remplacement:${v.id}:${v.replacement_year}`,
      title: `Remplacer ${v.unit_number} (${techno})`,
      due_date: `${v.replacement_year}-03-31`,
      vehicle_id: v.id,
      plan_year: v.replacement_year,
      subsidy_program: null,
    });

    if (v.target_technology === "bev" || v.target_technology === "fcev") {
      const { defauts } = analyserDonneesVehicule(v);
      if (!defauts) continue;
      const subventions = resoudreSubventionsVehicule({
        categorie: defauts.categorie,
        technologie: v.target_technology === "bev" ? "BEV" : "FCEV",
        prixAvantTaxes: defauts.prixAchat[v.target_technology === "bev" ? "BEV" : "FCEV"].valeur,
        typeOrganisme: options.typeOrganisme,
        anneeAchatCalendaire: v.replacement_year,
      });
      for (const s of subventions) {
        const prog = PROGRAMMES.find((p) => p.nom === s.libelle);
        if (!prog || statutEffectif(prog, `${options.anneeReference}-01-01`) !== "actif") continue;
        taches.push({
          auto_key: `subvention:${v.id}:${prog.id}`,
          title: `Déposer la demande ${prog.nom.split("—")[0].trim()} — ${v.unit_number}`,
          due_date: prog.dateFin ?? `${v.replacement_year}-03-31`,
          vehicle_id: v.id,
          plan_year: v.replacement_year,
          subsidy_program: prog.id,
        });
      }
    }
  }
  return taches;
}
