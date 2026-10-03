/**
 * Un seul sens → une seule couleur dans toute l'application. Chaque état
 * métier affiché en pastille passe par l'une de ces tables (testées) :
 * « vérifié » est vert partout, « à valider » ambre partout, etc.
 */
import type { Ton } from "./States";

/** Santé du plan (surveillance). */
export const TON_SANTE = { bon: "succes", a_surveiller: "attention", a_risque: "danger" } as const satisfies Record<string, Ton>;

/** Gravité d'une alerte. */
export const TON_GRAVITE = { critique: "danger", attention: "attention", info: "info" } as const satisfies Record<string, Ton>;

/** Statut effectif d'un programme de subvention. */
export const TON_PROGRAMME = { actif: "succes", ferme: "danger", echu: "danger", suspendu: "attention" } as const satisfies Record<string, Ton>;

/** Statut de vérification d'une hypothèse ou d'un programme. */
export const TON_VERIFICATION = { verifie: "succes", estimation: "info", a_valider: "attention" } as const satisfies Record<string, Ton>;

/** Provenance d'une donnée véhicule : mesurée ou saisie (succès) vs estimée. */
export const TON_SOURCE = { telematique: "succes", import: "succes", saisie: "succes", estimation: "info" } as const satisfies Record<string, Ton>;

/** Verdict de faisabilité d'une technologie. */
export const TON_VERDICT = { favorable: "succes", conditionnel: "attention", defavorable: "danger", non_evaluable: "neutre" } as const satisfies Record<string, Ton>;

/** Statut d'un véhicule de la flotte. */
export const TON_VEHICULE = { actif: "succes" } as const satisfies Record<string, Ton>;

export function ton<T extends Record<string, Ton>>(table: T, cle: string | null | undefined, defaut: Ton = "neutre"): Ton {
  return (cle && (table as Record<string, Ton>)[cle]) || defaut;
}
