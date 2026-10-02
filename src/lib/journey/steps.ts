/** Les 7 étapes du parcours projet (direction produit) :
 *  Flotte → Faisabilité → Stratégies → Plan → Financement → Rapports → Suivi. */
export const ETAPES_PARCOURS = [
  "flotte",
  "faisabilite",
  "strategies",
  "plan",
  "financement",
  "rapports",
  "suivi",
] as const;

export type EtapeParcoursCle = (typeof ETAPES_PARCOURS)[number];
