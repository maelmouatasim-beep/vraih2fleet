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
