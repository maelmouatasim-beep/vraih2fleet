import { describe, expect, it } from "vitest";
import { signDocumentUrl, signingKey, verifyDocumentUrl } from "./signed-url";

const key = signingKey("un-secret-de-test-suffisamment-long-0000");
const parse = (url: string) => {
  const u = new URL(url, "http://x");
  return [u.searchParams.get("e"), u.searchParams.get("s")] as const;
};

describe("liens signés", () => {
  const now = 1_800_000_000_000;
  const [e, s] = parse(signDocumentUrl(key, "doc-1", "user-1", now));

  it("valide pendant 5 minutes, pour ce document et cet utilisateur seulement", () => {
    expect(verifyDocumentUrl(key, "doc-1", "user-1", e, s, now + 299_000)).toBe(true);
    expect(verifyDocumentUrl(key, "doc-1", "user-1", e, s, now + 301_000)).toBe(false);
    expect(verifyDocumentUrl(key, "doc-2", "user-1", e, s, now)).toBe(false);
    expect(verifyDocumentUrl(key, "doc-1", "user-2", e, s, now)).toBe(false);
  });

  it("refuse signature altérée, absente, ou expiration forgée", () => {
    expect(verifyDocumentUrl(key, "doc-1", "user-1", e, `${s ?? ""}x`, now)).toBe(false);
    expect(verifyDocumentUrl(key, "doc-1", "user-1", null, s, now)).toBe(false);
    expect(verifyDocumentUrl(key, "doc-1", "user-1", "9999999999", s, now)).toBe(false);
    expect(verifyDocumentUrl(key, "doc-1", "user-1", "abc", s, now)).toBe(false);
    expect(
      verifyDocumentUrl(
        signingKey("autre-secret-0000000000000000000000"),
        "doc-1",
        "user-1",
        e,
        s,
        now,
      ),
    ).toBe(false);
  });
});
