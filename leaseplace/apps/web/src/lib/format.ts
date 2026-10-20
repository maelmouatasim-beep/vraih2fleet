/**
 * Formats d'affichage : dates jj/mm/aaaa dans le fuseau Africa/Casablanca,
 * quelle que soit la langue (règle produit). Chiffres latins partout,
 * y compris en arabe (usage marocain).
 */
const TIME_ZONE = "Africa/Casablanca";

function parts(date: Date, withTime: boolean) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
}

export function formatDate(date: Date): string {
  const p = parts(date, false);
  return `${p.day ?? ""}/${p.month ?? ""}/${p.year ?? ""}`;
}

export function formatDateTime(date: Date): string {
  const p = parts(date, true);
  return `${formatDate(date)} ${p.hour ?? ""}:${p.minute ?? ""}`;
}
