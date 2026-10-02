/**
 * Phase 5.4 — Valeurs « donnée client » DÉRIVÉES d'une pièce confirmée.
 * Module PUR et testé : l'IA (ou l'utilisateur) transcrit les montants
 * imprimés ; le prix unitaire est calculé ICI, formule affichée
 * (« 1 234,56 $ ÷ 450 L »). Une valeur qui ne peut pas être dérivée sans
 * deviner (montant avant taxes absent, quantité absente…) n'est PAS
 * produite : la cible reste vide et la raison est donnée.
 */
import type { TypeDocument } from "../../../supabase/functions/_shared/documentSchema";
import type { TypeBorne } from "@/lib/journey/infrastructure";

/** Valeurs confirmées par l'utilisateur, par champ (nombres ou textes). */
export type ValeursConfirmees = Record<string, number | string | null | undefined>;

export type CibleDerivee =
  | { cible: "diesel_price_per_l"; valeur: number; formule: Formule }
  | { cible: "electricity_cost_per_kwh"; valeur: number; formule: Formule }
  | { cible: "hq_rate"; valeur: "G" | "M" | "LG" | "autre"; formule: null }
  | { cible: "vehicle_quote_price"; valeur: number; technologie: "bev" | "fcev"; formule: Formule }
  | { cible: "charger_unit_cost"; valeur: number; typeBorne: TypeBorne; formule: Formule }
  | { cible: "grid_connection_quote"; valeur: number; formule: Formule };

/** Formule lisible : opérandes nommés (champ de la pièce) et opération. */
export interface Formule {
  operation: "valeur" | "division" | "soustraction_division";
  operandes: { champ: string; valeur: number }[];
}

export type RaisonNonDerivee =
  | "montant_avant_taxes_absent"
  | "quantite_absente"
  | "carburant_non_diesel"
  | "technologie_non_zero_emission"
  | "puissance_borne_absente"
  | "valeur_hors_bornes";

export interface ResultatDerivation {
  cibles: CibleDerivee[];
  nonDerivees: { cible: string; raison: RaisonNonDerivee }[];
}

const nb = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const txt = (v: unknown): string => (typeof v === "string" ? v : "").trim();
const arrondi = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

/** Bornes de plausibilité = contraintes CHECK de la base. */
const BORNES_VALEURS = {
  diesel_price_per_l: [0, 20],
  electricity_cost_per_kwh: [0, 5],
  vehicle_quote_price: [0, 10_000_000],
  charger_unit_cost: [0, 5_000_000],
  grid_connection_quote: [0, 100_000_000],
} as const;
const plausible = (cible: keyof typeof BORNES_VALEURS, v: number) =>
  v > BORNES_VALEURS[cible][0] && v < BORNES_VALEURS[cible][1];

/** Montant avant taxes : imprimé, sinon total − TPS − TVQ (les trois imprimés). */
function avantTaxes(v: ValeursConfirmees): { valeur: number; formule: Formule } | null {
  const ht = nb(v.montant_avant_taxes);
  if (ht != null && ht > 0) return { valeur: ht, formule: { operation: "valeur", operandes: [{ champ: "montant_avant_taxes", valeur: ht }] } };
  const total = nb(v.montant_total);
  const tps = nb(v.montant_tps);
  const tvq = nb(v.montant_tvq);
  if (total != null && tps != null && tvq != null && total - tps - tvq > 0) {
    return {
      valeur: total - tps - tvq,
      formule: {
        operation: "soustraction_division",
        operandes: [
          { champ: "montant_total", valeur: total },
          { champ: "montant_tps", valeur: tps },
          { champ: "montant_tvq", valeur: tvq },
        ],
      },
    };
  }
  return null;
}

function parUnite(
  cible: "diesel_price_per_l" | "electricity_cost_per_kwh",
  v: ValeursConfirmees,
  champQuantite: string,
  decimales: number,
): CibleDerivee | { cible: string; raison: RaisonNonDerivee } {
  const ht = avantTaxes(v);
  if (!ht) return { cible, raison: "montant_avant_taxes_absent" };
  const q = nb(v[champQuantite]);
  if (q == null || q <= 0) return { cible, raison: "quantite_absente" };
  const valeur = arrondi(ht.valeur / q, decimales);
  if (!plausible(cible, valeur)) return { cible, raison: "valeur_hors_bornes" };
  return {
    cible,
    valeur,
    formule: {
      operation: ht.formule.operation === "valeur" ? "division" : "soustraction_division",
      operandes: [...ht.formule.operandes, { champ: champQuantite, valeur: q }],
    },
  } as CibleDerivee;
}

/** Technologie d'un devis de véhicule (texte transcrit) → cible du moteur. */
export function technologieDevis(texte: string): "bev" | "fcev" | null {
  const t = texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/hydrog|fuel cell|pile a combustible|fcev/.test(t)) return "fcev";
  if (/electri|batter|bev|\bev\b/.test(t) && !/hybride|hybrid|phev/.test(t)) return "bev";
  return null;
}

/** Type de borne d'après la puissance unitaire (convention affichée,
 *  modifiable) : ≤ 19,2 kW = niveau 2 (CA) ; ≤ 100 kW = rapide 50 kW ;
 *  au-delà = rapide 150 kW. */
export function typeBorneDepuisPuissance(kw: number): TypeBorne {
  if (kw <= 19.2) return "niveau2";
  if (kw <= 100) return "rapide50";
  return "rapide150";
}

export function tarifHq(texte: string): "G" | "M" | "LG" | "autre" | null {
  const t = texte.trim().toUpperCase().replace(/^TARIF\s+/, "");
  if (!t) return null;
  if (t === "G" || t === "M" || t === "LG") return t;
  return "autre";
}

export function deriverValeurs(
  type: TypeDocument,
  v: ValeursConfirmees,
  options: { typeBorne?: TypeBorne | null } = {},
): ResultatDerivation {
  const cibles: CibleDerivee[] = [];
  const nonDerivees: ResultatDerivation["nonDerivees"] = [];
  const pousser = (r: CibleDerivee | { cible: string; raison: RaisonNonDerivee }) => {
    if ("raison" in r) nonDerivees.push(r);
    else cibles.push(r);
  };

  if (type === "fuel_invoice") {
    const carburant = txt(v.carburant).toLowerCase();
    if (carburant && !/diesel|di[eè]sel|gazole/.test(carburant)) {
      nonDerivees.push({ cible: "diesel_price_per_l", raison: "carburant_non_diesel" });
    } else {
      pousser(parUnite("diesel_price_per_l", v, "litres", 4));
    }
  } else if (type === "electricity_invoice") {
    pousser(parUnite("electricity_cost_per_kwh", v, "kwh", 4));
    const tarif = tarifHq(txt(v.tarif));
    if (tarif) cibles.push({ cible: "hq_rate", valeur: tarif, formule: null });
  } else if (type === "vehicle_quote") {
    const techno = technologieDevis(txt(v.technologie));
    if (!techno) {
      nonDerivees.push({ cible: "vehicle_quote_price", raison: "technologie_non_zero_emission" });
    } else {
      const unitaire = nb(v.prix_unitaire_avant_taxes);
      const total = nb(v.montant_avant_taxes);
      const quantite = nb(v.quantite);
      let r: { valeur: number; formule: Formule } | null = null;
      if (unitaire != null && unitaire > 0) {
        r = { valeur: unitaire, formule: { operation: "valeur", operandes: [{ champ: "prix_unitaire_avant_taxes", valeur: unitaire }] } };
      } else if (total != null && total > 0 && quantite != null && quantite > 0) {
        r = {
          valeur: arrondi(total / quantite, 2),
          formule: {
            operation: "division",
            operandes: [
              { champ: "montant_avant_taxes", valeur: total },
              { champ: "quantite", valeur: quantite },
            ],
          },
        };
      }
      if (!r) nonDerivees.push({ cible: "vehicle_quote_price", raison: total != null ? "quantite_absente" : "montant_avant_taxes_absent" });
      else if (!plausible("vehicle_quote_price", r.valeur)) nonDerivees.push({ cible: "vehicle_quote_price", raison: "valeur_hors_bornes" });
      else cibles.push({ cible: "vehicle_quote_price", valeur: r.valeur, technologie: techno, formule: r.formule });
    }
  } else if (type === "charger_quote") {
    const total = nb(v.montant_avant_taxes);
    const n = nb(v.nombre_bornes);
    const kw = nb(v.puissance_kw_par_borne);
    const typeBorne = options.typeBorne ?? (kw != null && kw > 0 ? typeBorneDepuisPuissance(kw) : null);
    if (total == null || total <= 0) nonDerivees.push({ cible: "charger_unit_cost", raison: "montant_avant_taxes_absent" });
    else if (n == null || n <= 0) nonDerivees.push({ cible: "charger_unit_cost", raison: "quantite_absente" });
    else if (!typeBorne) nonDerivees.push({ cible: "charger_unit_cost", raison: "puissance_borne_absente" });
    else {
      const valeur = arrondi(total / n, 2);
      if (!plausible("charger_unit_cost", valeur)) nonDerivees.push({ cible: "charger_unit_cost", raison: "valeur_hors_bornes" });
      else
        cibles.push({
          cible: "charger_unit_cost",
          valeur,
          typeBorne,
          formule: {
            operation: "division",
            operandes: [
              { champ: "montant_avant_taxes", valeur: total },
              { champ: "nombre_bornes", valeur: n },
            ],
          },
        });
    }
  } else if (type === "grid_quote") {
    const total = nb(v.montant_avant_taxes);
    if (total == null || total <= 0) nonDerivees.push({ cible: "grid_connection_quote", raison: "montant_avant_taxes_absent" });
    else if (!plausible("grid_connection_quote", total)) nonDerivees.push({ cible: "grid_connection_quote", raison: "valeur_hors_bornes" });
    else
      cibles.push({
        cible: "grid_connection_quote",
        valeur: total,
        formule: { operation: "valeur", operandes: [{ champ: "montant_avant_taxes", valeur: total }] },
      });
  }
  return { cibles, nonDerivees };
}
