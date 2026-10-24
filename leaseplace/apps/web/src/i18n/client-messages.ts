/**
 * Seules ces traductions partent vers le navigateur (composants clients) ;
 * le reste est rendu côté serveur. Un test vérifie que chaque
 * `useTranslations` d'un composant client est couvert.
 */
export const CLIENT_NAMESPACES = [
  "common",
  "nav",
  "palette",
  "simulator",
  "auth",
  "twoFactor",
  "landing.quick",
  "lessorsPage.form",
  "company",
] as const;

type Messages = { [key: string]: string | Messages };

export function pickMessages(messages: Messages, paths: readonly string[]): Messages {
  const out: Messages = {};
  for (const path of paths) {
    const keys = path.split(".");
    let src: string | Messages | undefined = messages;
    for (const k of keys) src = typeof src === "object" ? src[k] : undefined;
    if (src === undefined) continue;
    let dst = out;
    keys.slice(0, -1).forEach((k) => {
      const next = dst[k];
      dst = typeof next === "object" ? next : (dst[k] = {});
    });
    dst[keys.at(-1) ?? ""] = src;
  }
  return out;
}
