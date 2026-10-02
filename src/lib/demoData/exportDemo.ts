/**
 * Démo (Phase 5.3) : EXPORT FICTIF d'un logiciel de gestion de flotte de
 * la Ville de Rivière-Claire, pour essayer l'import intelligent sur la
 * démo. Volontairement désordonné : titre au-dessus de l'entête,
 * séparateur « ; », entêtes non standard, milles et mpg, colonne
 * personnelle (opérateur), libellés inconnus ou ambigus (« Gaz » :
 * essence ou gaz naturel ?), doublon probable, année future, nouveau
 * garage, mise à jour d'une unité existante. Toutes les données sont
 * FICTIVES et déterministes.
 */
export const NOM_EXPORT_DEMO = "export-gestflotte-riviere-claire.csv";

export function exportInventaireDemo(): string {
  return [
    "Rapport GestFlotte — Ville de Rivière-Claire (données fictives de démonstration)",
    "",
    "No équipement;Type véhicule;Énergie;Odomètre annuel (mi);Rendement (mpg);Opérateur attitré;Emplacement;Modèle année;Statut flotte",
    "C-02;Camionnette;Diesel;12 000;17;Opérateur A;Garage central;2015;En service",
    "N-01;Fourgon aménagé;Essence;8 500;16;Opérateur B;Garage Est;2022;En service",
    "N-02;Outil multiservice;Diesel;1 900;;;Dépôt Nord;2031;En service",
    "N-03;Fourgon aménagé;Gaz;7 200;18;Opérateur C;Garage Est;2020;Hors service",
    "C 01;Camionnette;Diesel;9 942;17;;Dépôt Nord;2010;En service",
  ].join("\n");
}
