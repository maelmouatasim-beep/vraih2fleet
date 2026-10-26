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

/** Jour au format ISO (aaaa-mm-jj) à Casablanca : valeur des champs date. */
export function isoDay(date: Date = new Date()): string {
  const p = parts(date, false);
  return `${p.year ?? ""}-${p.month ?? ""}-${p.day ?? ""}`;
}

export function formatDateTime(date: Date): string {
  const p = parts(date, true);
  return `${formatDate(date)} ${p.hour ?? ""}:${p.minute ?? ""}`;
}

/*
 * Nombres et montants : format marocain unique, quelle que soit la langue
 * de l'interface (règle produit, comme les dates) — « 1 250 000,00 DH »,
 * espace fine insécable entre milliers, virgule décimale, chiffres latins.
 */
const NNBSP = "\u202f";
const NBSP = "\u00a0";

function grouped(value: number, decimals: number): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int = "0", dec] = fixed.split(".");
  const withGroups = int.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  const sign = value < 0 && Number(fixed) !== 0 ? "−" : "";
  return `${sign}${withGroups}${dec ? `,${dec}` : ""}`;
}

export function formatMad(value: number, decimals = 2): string {
  return `${grouped(value, decimals)}${NBSP}DH`;
}

export function formatNumber(value: number, decimals = 0): string {
  return grouped(value, decimals);
}

/** 0,0947 → « 9,47 % ». */
export function formatPercent(fraction: number, decimals = 2): string {
  return `${grouped(fraction * 100, decimals)}${NNBSP}%`;
}

/**
 * Saisie d'un montant : espaces (y compris insécables) ignorés, virgule ou
 * point décimal. Renvoie null si la saisie n'est pas un nombre.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/(dh|mad)$/i, "")
    .replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/**
 * Isole un montant ou un pourcentage dans un texte de droite à gauche
 * (arabe) : « 61 693,46 DH » ne doit jamais devenir « DH 61 693,46 ».
 * Caractères invisibles LRI…PDI (Unicode Bidi, isolat gauche-à-droite).
 */
export function ltr(text: string): string {
  return `⁦${text}⁩`;
}
