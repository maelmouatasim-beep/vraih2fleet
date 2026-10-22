/**
 * Pages par secteur. Les paramètres d'exemple sont ILLUSTRATIFS (affichés
 * comme tels) et ouvrent le simulateur prérempli ; ils ne décrivent pas le
 * marché.
 */
import type { SimulatorParams } from "./simulator";

export const SECTORS = ["transport", "btp", "medical"] as const;
export type Sector = (typeof SECTORS)[number];

export const SECTOR_EXAMPLES: Readonly<Record<Sector, Partial<SimulatorParams>>> = {
  transport: { amount: 1_200_000, months: 60, firstRentPct: 10, residualPct: 1 },
  btp: {
    amount: 2_500_000,
    months: 60,
    periodicity: "quarterly",
    firstRentPct: 15,
    residualPct: 2,
  },
  medical: { amount: 800_000, months: 48, firstRentPct: 10, residualPct: 1 },
};

export function isSector(value: string): value is Sector {
  return (SECTORS as readonly string[]).includes(value);
}
