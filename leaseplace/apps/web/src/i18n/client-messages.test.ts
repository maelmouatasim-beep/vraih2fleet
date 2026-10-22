import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_NAMESPACES, pickMessages } from "./client-messages";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("traductions envoyées au navigateur", () => {
  it("extrait seulement les espaces demandés, y compris imbriqués", () => {
    const m = { a: { x: "1", y: "2" }, b: { c: { d: "3" }, e: "4" }, f: "5" };
    expect(pickMessages(m, ["a", "b.c", "absent"])).toEqual({
      a: { x: "1", y: "2" },
      b: { c: { d: "3" } },
    });
  });

  it("chaque useTranslations d'un composant client est couvert", () => {
    const src = join(__dirname, "..");
    const missing: string[] = [];
    for (const f of files(src)) {
      const code = readFileSync(f, "utf8");
      if (!code.startsWith('"use client"')) continue;
      for (const m of code.matchAll(/useTranslations\("([^"]+)"\)/g)) {
        const ns = m[1] ?? "";
        if (!CLIENT_NAMESPACES.some((c) => ns === c || ns.startsWith(`${c}.`)))
          missing.push(`${f}: ${ns}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
