/**
 * Meilleur SOUS-ENSEMBLE de véhicules à électrifier dans UN garage, bornes
 * et raccordement compris (logique pure, sans moteur).
 *
 * Le coût d'infrastructure d'un garage a deux parts :
 *  - une borne par véhicule (coût et puissance selon sa catégorie) : elle
 *    est comptée DANS la valeur nette de chaque candidat ;
 *  - le raccordement, fonction en escalier de la puissance TOTALE demandée
 *    (capacité existante → 0 $, puis paliers 1, 2, 3 du registre ; un devis
 *    du garage remplace l'escalier dès qu'une borne est installée).
 *
 * Pour chaque marche de l'escalier, on cherche le sous-ensemble de valeur
 * nette maximale dont la puissance tient sous le plafond de la marche
 * (problème du sac à dos 0/1 sur les kW, résolu exactement par
 * programmation dynamique), puis on retire le coût de la marche. Chaque
 * proposition est ensuite RE-CHIFFRÉE par le moteur par l'appelant (les
 * années d'arrivée et la mise en service commune des bornes du garage
 * rendent la somme approximative) : ce module ne fait que proposer.
 */

export interface CandidatGarage {
  id: string;
  /** Puissance maximale de sa borne (kW, sans gestion de charge). */
  kw: number;
  /** VAN du véhicule seul AVEC sa borne, sans raccordement (moteur). */
  net: number;
}

export interface MarcheRaccordement {
  /** 0 = capacité existante ; 1..3 = palier du registre ; « devis » = devis du garage. */
  palier: 0 | 1 | 2 | 3 | "devis";
  /** Puissance totale maximale admise par la marche (kW). */
  kwMax: number;
  /** Coût du raccordement de la marche ($ avant taxes). */
  cout: number;
}

export interface PropositionGarage {
  ids: string[];
  marche: MarcheRaccordement;
  /** Σ net − coût de la marche (estimation avant re-chiffrage). */
  valeurEstimee: number;
}

/** Escalier du raccordement d'un garage (mêmes règles que calculerRaccordement). */
export function marchesRaccordement(
  kwDisponibles: number,
  paliers: readonly { palier: 1 | 2 | 3; kwMax: number; cout: number }[],
  devisGarage: number | null,
): MarcheRaccordement[] {
  if (devisGarage != null) return [{ palier: "devis", kwMax: Infinity, cout: devisGarage }];
  return [
    { palier: 0, kwMax: kwDisponibles, cout: 0 },
    ...paliers.map((p) => ({ palier: p.palier, kwMax: kwDisponibles + p.kwMax, cout: p.cout })),
  ];
}

/** Sac à dos 0/1 exact : valeur nette maximale sous un plafond de kW. */
function sacADos(candidats: CandidatGarage[], plafondKw: number): string[] {
  const utiles = candidats.filter((c) => c.net > 0);
  const total = utiles.reduce((s, c) => s + c.kw, 0);
  if (total <= plafondKw) return utiles.map((c) => c.id);
  const cap = Math.max(0, Math.floor(plafondKw));
  const poids = utiles.map((c) => Math.max(0, Math.ceil(c.kw)));
  // meilleur[w] = valeur max avec un poids ≤ w ; choix mémorisé par ligne.
  const meilleur = new Float64Array(cap + 1);
  const pris: Uint8Array[] = [];
  for (let i = 0; i < utiles.length; i++) {
    const ligne = new Uint8Array(cap + 1);
    for (let w = cap; w >= poids[i]; w--) {
      const avec = meilleur[w - poids[i]] + utiles[i].net;
      if (avec > meilleur[w] + 1e-9) {
        meilleur[w] = avec;
        ligne[w] = 1;
      }
    }
    pris.push(ligne);
  }
  const ids: string[] = [];
  let w = cap;
  for (let i = utiles.length - 1; i >= 0; i--) {
    if (pris[i][w]) {
      ids.push(utiles[i].id);
      w -= poids[i];
    }
  }
  return ids.reverse();
}

/**
 * Une proposition par marche de l'escalier (sous-ensemble non vide de
 * valeur estimée la plus haute sous son plafond), triées de la meilleure
 * à la moins bonne valeur estimée. Liste vide si aucun candidat n'a de
 * valeur nette positive (la borne coûte plus que l'économie).
 */
export function proposerSousEnsembles(
  candidats: CandidatGarage[],
  marches: MarcheRaccordement[],
): PropositionGarage[] {
  const net = new Map(candidats.map((c) => [c.id, c.net]));
  const vues = new Set<string>();
  const propositions: PropositionGarage[] = [];
  for (const marche of marches) {
    const ids = sacADos(candidats, marche.kwMax);
    if (ids.length === 0) continue;
    const cle = [...ids].sort().join("|");
    if (vues.has(cle)) continue;
    vues.add(cle);
    const somme = ids.reduce((s, id) => s + (net.get(id) ?? 0), 0);
    propositions.push({ ids, marche, valeurEstimee: somme - marche.cout });
  }
  return propositions.sort((a, b) => b.valeurEstimee - a.valeurEstimee);
}
