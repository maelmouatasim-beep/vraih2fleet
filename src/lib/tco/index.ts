/**
 * Moteur TCO unique de H2Fleet — voir docs/tco-methodologie.md.
 * Toute consommation du moteur passe par ce barrel.
 */
export * from './assumption-types';
export * from './types';
export { HYPOTHESES, DEFAUTS_CATEGORIES, LISTE_HYPOTHESES } from './assumptions';
export { PROGRAMMES, programmesActifs } from './subsidy-programs';
export type { ProgrammeSubvention, TypeOrganisme, StatutProgramme } from './subsidy-programs';
export { resoudreSubventionsVehicule } from './subsidy-resolver';
export type { DemandeSubventions } from './subsidy-resolver';
export { calculerPlan, energieAnnuelleFacturee } from './engine';
export { analyserSensibilite, parametresStandards } from './sensitivity';
export type { ResultatSensibilite, ParametreSensibilite, NiveauRisque, BarreTornade } from './sensitivity';
export { ENGINE_VERSION, empreinte, serialiserCanonique } from './fingerprint';
export * from './units';
