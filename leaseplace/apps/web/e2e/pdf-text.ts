import { inflateSync } from "node:zlib";

/**
 * Textes dessinés dans un PDF produit par pdf-lib (flux compressés,
 * chaînes hexadécimales WinAnsi `<…> Tj`). Suffisant pour vérifier un
 * filigrane dans les tests ; ce n'est pas un extracteur général.
 */
export function pdfTexts(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString("latin1");
  const out: string[] = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(m[1] ?? "", "latin1")).toString("latin1");
    } catch {
      content = m[1] ?? "";
    }
    for (const t of content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g))
      out.push(Buffer.from(t[1] ?? "", "hex").toString("latin1"));
  }
  return out;
}
