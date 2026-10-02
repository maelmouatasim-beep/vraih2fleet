/**
 * Véhicule du projet tel que le moteur le chiffre : véhicule de « Ma
 * flotte » + année et cible du plan + subventions confirmées + prix
 * devisé (pièce confirmée). SOURCE UNIQUE pour toutes les étapes, le
 * copilote et l'état du parcours. Module PUR (import de types seulement).
 */
import type { ProjectVehicleWithVehicle } from "@/lib/fleet/projectVehicles";
import type { SubventionConfirmee } from "@/lib/confirmedSubsidies";
import type { VehiculeProjet } from "./strategies";

export function vehiculeProjetDepuis(
  pv: ProjectVehicleWithVehicle,
  confirmees?: SubventionConfirmee[],
): VehiculeProjet {
  const prix = pv.quote_price != null ? Number(pv.quote_price) : null;
  const techno = pv.quote_technology === "bev" ? "BEV" : pv.quote_technology === "fcev" ? "FCEV" : null;
  return {
    ...pv.vehicles,
    replacement_year: pv.replacement_year,
    target_technology: pv.target_technology,
    subventionsConfirmees: confirmees,
    prixDevis: prix != null && prix > 0 && techno ? { technologie: techno, prix, documentId: pv.quote_document_id ?? null } : null,
  };
}
