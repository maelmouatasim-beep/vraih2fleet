/**
 * Garages — logique PURE (testable sans client Supabase) : garages à
 * créer à l'import, caractéristiques pour le dimensionnement, durée de
 * la fenêtre de recharge. Les accès base sont dans ./garages.ts.
 */
import type { Tables } from "@/integrations/supabase/types";
import { cleGarage, TYPES_BORNE, type CaracteristiquesGarage, type TypeBorne } from "@/lib/journey/infrastructure";

export type GarageRow = Tables<"garages">;

export const TARIFS_HQ = ["G", "M", "LG", "autre"] as const;

/** Noms de dépôts (import) qui n'ont pas encore de garage — dédoublonnés
 *  par clé (casse et espaces ignorés), dans l'ordre d'apparition. */
export function garagesACreer(depots: (string | null | undefined)[], existants: { name: string }[]): string[] {
  const connus = new Set(existants.map((g) => cleGarage(g.name)));
  const nouveaux: string[] = [];
  for (const d of depots) {
    const nom = d?.trim().replace(/\s+/g, " ");
    if (!nom) continue;
    const cle = cleGarage(nom);
    if (connus.has(cle)) continue;
    connus.add(cle);
    nouveaux.push(nom);
  }
  return nouveaux;
}

/** Garages des véhicules d'un projet dont la puissance disponible n'est PAS
 *  renseignée (le calcul retient alors la valeur présumée du registre) —
 *  dédoublonnés par clé, dans l'ordre d'apparition ; `null` = véhicules
 *  sans garage (audit acheteur, point 8). */
export function garagesPuissancePresumee(
  depots: (string | null | undefined)[],
  garages: Pick<GarageRow, "name" | "available_power_kw">[],
): (string | null)[] {
  const renseignes = new Set(
    garages.filter((g) => g.available_power_kw != null && g.available_power_kw >= 0).map((g) => cleGarage(g.name)),
  );
  const vus = new Set<string>();
  const out: (string | null)[] = [];
  for (const d of depots) {
    const cle = cleGarage(d);
    if (renseignes.has(cle) || vus.has(cle)) continue;
    vus.add(cle);
    const nom = d?.trim().replace(/\s+/g, " ");
    out.push(nom ? nom : null);
  }
  return out;
}

/** Devis de bornes d'un garage (JSON { type: coût unitaire installé }),
 *  filtré aux types connus et aux montants positifs. */
export function lireDevisBornes(json: unknown): Partial<Record<TypeBorne, number>> | undefined {
  if (!json || typeof json !== "object" || Array.isArray(json)) return undefined;
  const out: Partial<Record<TypeBorne, number>> = {};
  for (const type of TYPES_BORNE) {
    const v = (json as Record<string, unknown>)[type];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[type] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Caractéristiques connues des garages pour le dimensionnement. */
export function caracteristiquesGarages(garages: GarageRow[]): Map<string, CaracteristiquesGarage> {
  const m = new Map<string, CaracteristiquesGarage>();
  for (const g of garages) {
    m.set(cleGarage(g.name), {
      puissanceDisponibleKw: g.available_power_kw ?? undefined,
      devisRaccordement: g.grid_connection_quote ?? undefined,
      coutBorneDevis: lireDevisBornes(g.charger_unit_quote),
      fenetreRecharge:
        g.return_time && g.departure_time ? { retour: g.return_time, depart: g.departure_time } : undefined,
      ravitaillementH2:
        g.h2_refuelling === "depot" || g.h2_refuelling === "externe" ? g.h2_refuelling : "auto",
      prixH2ExterneParKg: g.h2_external_price_per_kg ?? undefined,
      detourH2KmParJour: g.h2_detour_km_per_day ?? undefined,
    });
  }
  return m;
}

/** Durée de la fenêtre de recharge (h) entre le retour et le départ,
 *  à cheval sur minuit le cas échéant ; null si incomplète. */
export function heuresFenetre(retour: string | null | undefined, depart: string | null | undefined): number | null {
  if (!retour || !depart) return null;
  const min = (h: string) => {
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + (mm || 0);
  };
  let d = min(depart) - min(retour);
  if (d <= 0) d += 24 * 60;
  return Math.round((d / 60) * 100) / 100;
}
