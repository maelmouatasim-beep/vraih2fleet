import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce } from "./csp";

describe("CSP", () => {
  it("production : nonce, strict-dynamic, aucun eval, aucun cadre", () => {
    const csp = buildCsp("abc", { dev: false, https: true });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("développement : eval et websocket du rechargement à chaud seulement", () => {
    const csp = buildCsp("abc", { dev: true, https: false });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("nonce aléatoire de 128 bits", () => {
    const a = generateNonce();
    expect(atob(a)).toHaveLength(16);
    expect(generateNonce()).not.toBe(a);
  });
});
