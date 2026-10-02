/**
 * Délai de récupération en clair (revue 1.4) — PDF et Excel. Jamais
 * « 0 an » sur un surcoût : le moteur renvoie null (« jamais ») avec un
 * code de raison quand le cumul reste négatif à l'horizon.
 */
import type { Payback } from "@/lib/tco";

const RAISONS = {
  fr: {
    economies_negatives: "les économies annuelles sont nulles ou négatives",
    surcout_non_resorbe: (h: number) => `le surcoût n'est pas résorbé sur l'horizon de ${h} ans`,
  },
  en: {
    economies_negatives: "annual savings are zero or negative",
    surcout_non_resorbe: (h: number) => `the extra cost is not recovered within the ${h}-year horizon`,
  },
};

export function raisonJamais(p: Payback, horizonAns: number, en = false): string {
  const r = en ? RAISONS.en : RAISONS.fr;
  return p.code === "economies_negatives" ? r.economies_negatives : r.surcout_non_resorbe(horizonAns);
}

export function texteRecuperation(p: Payback, horizonAns: number, en = false): string {
  if (p.annees != null) return en ? `${p.annees} yrs` : `${p.annees} ans`;
  return `${en ? "never" : "jamais"} (${raisonJamais(p, horizonAns, en)})`;
}
