import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--lp-([a-z-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1] ?? "", m[2] ?? ""]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

// [texte, fond, ratio minimal] — 4.5 texte courant, 3 éléments graphiques.
const PAIRS: [string, string, number][] = [
  ["fg", "bg", 4.5],
  ["fg", "surface", 4.5],
  ["fg", "surface-muted", 4.5],
  ["fg-muted", "bg", 4.5],
  ["fg-muted", "surface", 4.5],
  ["fg-muted", "surface-muted", 4.5],
  ["fg-subtle", "surface", 4.5],
  ["fg-subtle", "bg", 4.5],
  ["fg-subtle", "surface-muted", 4.5],
  ["fg-subtle", "surface-sunken", 4.5],
  ["primary-fg", "primary", 4.5],
  ["primary-fg", "primary-hover", 4.5],
  ["primary", "surface", 4.5],
  ["primary-soft-fg", "primary-soft", 4.5],
  ["accent-strong", "surface", 4.5],
  ["accent-strong", "accent-soft", 4.5],
  ["success", "success-soft", 4.5],
  ["warning", "warning-soft", 4.5],
  ["danger", "danger-soft", 4.5],
  ["danger", "surface", 4.5],
  ["info", "info-soft", 4.5],
  ["brand-fg", "brand", 4.5],
  ["brand-fg", "brand-deep", 4.5],
  ["ring", "surface", 3],
  ["ring", "bg", 3],
  ["accent", "surface", 3],
  ["border-strong", "surface", 1.3],
];

describe.each([":root", ".dark"])("contrastes WCAG AA — %s", (selector) => {
  const tokens = block(selector);
  it.each(PAIRS)("%s sur %s ≥ %s", (fg, bg, min) => {
    const a = tokens[fg];
    const b = tokens[bg];
    expect(a, fg).toBeDefined();
    expect(b, bg).toBeDefined();
    expect(contrast(a ?? "", b ?? "")).toBeGreaterThanOrEqual(min);
  });
});

it("les deux thèmes déclarent les mêmes tokens de couleur", () => {
  expect(Object.keys(block(".dark")).sort()).toEqual(Object.keys(block(":root")).sort());
});
