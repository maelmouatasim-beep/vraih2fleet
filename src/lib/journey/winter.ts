/**
 * Test terrain, bloc 2.4 — diagnostic hiver / autonomie d'un véhicule
 * électrique à batterie, PUR et chiffré :
 *
 *   autonomie hiver (km) = batterie utile × (1 − réserve)
 *                          ÷ [conso nominale × (1 + majoration hiver) × (1 + charge utile) ÷ 100]
 *   énergie du jour (kWh) = km journalier max × conso hiver chargée ÷ 100
 *   énergie de nuit (kWh) = fenêtre du garage (h) × puissance de la borne × rendement de recharge
 *
 * Verdict :
 *  - « tient l'hiver » : km max ≤ autonomie hiver ET énergie du jour ≤ énergie de nuit ;
 *  - « tient avec recharge en journée » : au plus UNE recharge complète en
 *    cours de journée suffit (km max ≤ 2 × autonomie hiver), ou la nuit ne
 *    suffit pas à refaire le plein — l'énergie à reprendre le jour est chiffrée ;
 *  - « ne tient pas » : au-delà.
 * Toutes les valeurs viennent du registre (statut affiché) ou de la fiche
 * du véhicule et du garage ; ce qui est présumé est signalé.
 */
import { DEFAUTS_CATEGORIES, HYPOTHESES } from "@/lib/tco";
import { BORNES, TYPE_BORNE_PAR_CATEGORIE } from "./infrastructure";
import { categorieMoteur } from "./categories";

export type VerdictHiver = "tient" | "recharge_journee" | "ne_tient_pas";

export interface DiagnosticHiver {
  verdict: VerdictHiver;
  autonomieNominaleKm: number;
  autonomieHiverKm: number;
  kmJour: number;
  kmJourSource: "saisi" | "estime";
  fenetreH: number;
  fenetreSource: "garage" | "presumee";
  puissanceBorneKw: number;
  energieJourKwh: number;
  energieNuitKwh: number;
  /** Énergie à reprendre en cours de journée (0 si la nuit suffit). */
  energieJourneeKwh: number;
}

export interface EntreeHiver {
  category: string;
  annual_km: number | null;
  max_daily_km?: number | null;
  /** Fenêtre du garage (« HH:MM[:SS] »), si renseignée. */
  fenetre?: { retour: string; depart: string };
}

function heures(retour: string, depart: string): number {
  const m = (h: string) => {
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + (mm || 0);
  };
  let d = m(depart) - m(retour);
  if (d <= 0) d += 24 * 60;
  return d / 60;
}

const arrondi = (x: number, n = 0) => Math.round(x * 10 ** n) / 10 ** n;

/** null si la catégorie n'est pas connue du moteur (« autre »). */
export function diagnostiquerHiver(v: EntreeHiver): DiagnosticHiver | null {
  const cle = categorieMoteur(v.category);
  if (!cle) return null;
  const d = DEFAUTS_CATEGORIES[cle];
  const consoNominale = d.consommation.BEV.valeur; // kWh/100 km, tempéré
  const batterie = d.batterieUtileKwh.valeur;
  const utile = batterie * (1 - HYPOTHESES.reserve_batterie.valeur);
  const consoHiver =
    consoNominale * (1 + HYPOTHESES.majoration_hivernale_bev.valeur) * (1 + HYPOTHESES.majoration_charge_utile.valeur);
  const autonomieNominaleKm = (batterie / consoNominale) * 100;
  const autonomieHiverKm = (utile / consoHiver) * 100;

  const kmSaisi = v.max_daily_km != null && v.max_daily_km > 0;
  const kmJour = kmSaisi
    ? v.max_daily_km!
    : (v.annual_km && v.annual_km > 0 ? v.annual_km : d.kmParAnDefaut) / HYPOTHESES.jours_utilisation_an.valeur;

  const fenetreH = v.fenetre ? heures(v.fenetre.retour, v.fenetre.depart) : HYPOTHESES.fenetre_recharge_presumee.valeur;
  const borne = BORNES[TYPE_BORNE_PAR_CATEGORIE[cle] ?? "niveau2"];
  const puissanceBorneKw = borne.puissanceMaxKw;
  const energieJourKwh = (kmJour * consoHiver) / 100;
  const energieNuitKwh = Math.min(fenetreH * puissanceBorneKw * HYPOTHESES.rendement_recharge.valeur, batterie);
  const energieJourneeKwh = Math.max(0, energieJourKwh - Math.min(energieNuitKwh, utile));

  let verdict: VerdictHiver;
  if (kmJour <= autonomieHiverKm && energieJourKwh <= energieNuitKwh) verdict = "tient";
  else if (kmJour <= 2 * autonomieHiverKm) verdict = "recharge_journee";
  else verdict = "ne_tient_pas";

  return {
    verdict,
    autonomieNominaleKm: arrondi(autonomieNominaleKm),
    autonomieHiverKm: arrondi(autonomieHiverKm),
    kmJour: arrondi(kmJour),
    kmJourSource: kmSaisi ? "saisi" : "estime",
    fenetreH: arrondi(fenetreH, 1),
    fenetreSource: v.fenetre ? "garage" : "presumee",
    puissanceBorneKw,
    energieJourKwh: arrondi(energieJourKwh),
    energieNuitKwh: arrondi(energieNuitKwh),
    energieJourneeKwh: arrondi(energieJourneeKwh),
  };
}
