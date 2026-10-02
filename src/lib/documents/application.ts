/**
 * Phase 5.4 — Ce qu'une pièce CONFIRMÉE écrit, et où : liste des
 * écritures avec la valeur AVANT et APRÈS (aperçu montré avant la
 * confirmation, puis journalisé). Module PUR et testé ; l'exécution est
 * dans src/lib/supabase/clientDocuments.ts.
 */
import type { CibleDerivee } from "./derivation";
import type { TypeBorne } from "@/lib/journey/infrastructure";

export type Ecriture =
  | {
      table: "energy_client_inputs";
      portee: "organisation" | "projet";
      champ: "diesel_price_per_l" | "electricity_cost_per_kwh";
      lienDocument: "diesel_document_id" | "electricity_document_id";
      avant: number | null;
      apres: number;
      libelleCible: string;
    }
  | { table: "garages"; garageId: string; champ: "hq_rate"; avant: string | null; apres: string; libelleCible: string }
  | { table: "garages"; garageId: string; champ: "grid_connection_quote"; avant: number | null; apres: number; libelleCible: string }
  | {
      table: "garages";
      garageId: string;
      champ: "charger_unit_quote";
      typeBorne: TypeBorne;
      avant: number | null;
      apres: number;
      /** Devis de bornes complet après écriture (les autres types sont conservés). */
      devisComplet: Partial<Record<TypeBorne, number>>;
      libelleCible: string;
    }
  | {
      table: "project_vehicles";
      projectVehicleId: string;
      champ: "quote_price";
      technologie: "bev" | "fcev";
      avant: number | null;
      apres: number;
      libelleCible: string;
    };

export interface ContexteApplication {
  /** Portée des prix d'énergie : organisation (défaut) ou projet. */
  portee: "organisation" | "projet";
  energieActuelle: { diesel_price_per_l: number | null; electricity_cost_per_kwh: number | null };
  garage: { id: string; name: string; hq_rate: string | null; grid_connection_quote: number | null; charger_unit_quote: Partial<Record<TypeBorne, number>> } | null;
  /** Véhicules du projet choisis pour un devis de véhicule. */
  vehicules: { id: string; unite: string; quote_price: number | null; quote_technology: string | null }[];
}

export type RaisonBlocage = "garage_requis" | "vehicules_requis";

export function planifierEcritures(
  derivees: CibleDerivee[],
  ctx: ContexteApplication,
): { ecritures: Ecriture[]; blocages: RaisonBlocage[] } {
  const ecritures: Ecriture[] = [];
  const blocages = new Set<RaisonBlocage>();
  const libelleEnergie = ctx.portee === "projet" ? "projet" : "organisation";
  for (const d of derivees) {
    switch (d.cible) {
      case "diesel_price_per_l":
      case "electricity_cost_per_kwh":
        ecritures.push({
          table: "energy_client_inputs",
          portee: ctx.portee,
          champ: d.cible,
          lienDocument: d.cible === "diesel_price_per_l" ? "diesel_document_id" : "electricity_document_id",
          avant: ctx.energieActuelle[d.cible],
          apres: d.valeur,
          libelleCible: libelleEnergie,
        });
        break;
      case "hq_rate":
        if (!ctx.garage) break; // le tarif est facultatif : rien sans garage choisi
        ecritures.push({ table: "garages", garageId: ctx.garage.id, champ: "hq_rate", avant: ctx.garage.hq_rate, apres: d.valeur, libelleCible: ctx.garage.name });
        break;
      case "grid_connection_quote":
        if (!ctx.garage) {
          blocages.add("garage_requis");
          break;
        }
        ecritures.push({
          table: "garages",
          garageId: ctx.garage.id,
          champ: "grid_connection_quote",
          avant: ctx.garage.grid_connection_quote,
          apres: d.valeur,
          libelleCible: ctx.garage.name,
        });
        break;
      case "charger_unit_cost":
        if (!ctx.garage) {
          blocages.add("garage_requis");
          break;
        }
        ecritures.push({
          table: "garages",
          garageId: ctx.garage.id,
          champ: "charger_unit_quote",
          typeBorne: d.typeBorne,
          avant: ctx.garage.charger_unit_quote[d.typeBorne] ?? null,
          apres: d.valeur,
          devisComplet: { ...ctx.garage.charger_unit_quote, [d.typeBorne]: d.valeur },
          libelleCible: ctx.garage.name,
        });
        break;
      case "vehicle_quote_price":
        if (ctx.vehicules.length === 0) {
          blocages.add("vehicules_requis");
          break;
        }
        for (const v of ctx.vehicules) {
          ecritures.push({
            table: "project_vehicles",
            projectVehicleId: v.id,
            champ: "quote_price",
            technologie: d.technologie,
            avant: v.quote_technology === d.technologie ? v.quote_price : null,
            apres: d.valeur,
            libelleCible: v.unite,
          });
        }
        break;
    }
  }
  return { ecritures, blocages: [...blocages] };
}

/** Écritures → entrées du journal (aperçu avant → après). */
export function changementsJournal(ecritures: Ecriture[]): { cible: string; champ: string; avant: string | number | null; apres: string | number | null }[] {
  return ecritures.map((e) => ({
    cible: e.libelleCible,
    champ: e.champ === "charger_unit_quote" ? `charger_unit_quote.${e.typeBorne}` : e.champ,
    avant: e.avant,
    apres: e.apres,
  }));
}
