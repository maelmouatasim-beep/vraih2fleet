/**
 * Conversions d'unités du moteur TCO — LA seule fonction de conversion
 * (docs/tco-methodologie.md §2.4). Toute conversion d'unité dans le code
 * du moteur passe par ce module ; il est couvert par des tests.
 *
 * Unités canoniques :
 * - consommations : L/100 km, kWh/100 km, kg H2/100 km
 * - facteur d'émission réseau : g CO2e/kWh (unité des publications ECCC)
 * - facteur d'émission diesel : kg CO2e/L ; H2 : kg CO2e/kg
 * - émissions agrégées : t CO2e
 */

/** g → kg */
export function gVersKg(g: number): number {
  return g / 1000;
}

/** kg → t */
export function kgVersTonnes(kg: number): number {
  return kg / 1000;
}

/** g → t */
export function gVersTonnes(g: number): number {
  return g / 1_000_000;
}

/** consommation par 100 km → consommation par km */
export function par100kmVersParKm(par100km: number): number {
  return par100km / 100;
}

/** kWh → MWh */
export function kWhVersMWh(kWh: number): number {
  return kWh / 1000;
}

/**
 * Facteur réseau exprimé en kg CO2e/MWh (ancienne convention interne) →
 * g CO2e/kWh (canonique). Numériquement identique : 1 kg/MWh = 1 g/kWh.
 * La fonction existe pour rendre la conversion EXPLICITE et testée —
 * l'ancienne base mélangeait kg/kWh et kg/MWh (erreur ×1000).
 */
export function kgParMWhVersGParKWh(kgParMWh: number): number {
  return kgParMWh;
}

/** kg CO2e/kWh (unité de saisie fréquente mais ambiguë) → g CO2e/kWh. */
export function kgParKWhVersGParKWh(kgParKWh: number): number {
  return kgParKWh * 1000;
}

/** Taux décimal (0.05) → pourcentage d'affichage (5). AFFICHAGE SEULEMENT. */
export function tauxVersPourcentageAffichage(taux: number): number {
  return taux * 100;
}
