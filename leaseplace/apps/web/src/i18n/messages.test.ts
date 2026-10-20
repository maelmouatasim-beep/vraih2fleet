import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const FR = flatten(fr as Tree);

describe.each([
  ["en", en],
  ["ar", ar],
])("parité fr ↔ %s", (_name, messages) => {
  const other = flatten(messages as Tree);
  it("mêmes clés", () => {
    expect([...other.keys()].sort()).toEqual([...FR.keys()].sort());
  });
  it("mêmes variables dans chaque texte", () => {
    for (const [key, text] of FR)
      expect(placeholders(other.get(key) ?? ""), key).toEqual(placeholders(text));
  });
  it("aucun texte vide", () => {
    for (const [key, text] of other) expect(text.trim(), key).not.toBe("");
  });
});

describe("typographie française", () => {
  it("espace insécable avant : ; ? ! (jamais une espace simple)", () => {
    for (const [key, text] of FR) expect(text, key).not.toMatch(/ [:;?!]/);
  });
  it("apostrophe typographique", () => {
    for (const [key, text] of FR) expect(text, key).not.toMatch(/'/);
  });
});
