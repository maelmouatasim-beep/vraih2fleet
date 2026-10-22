import { describe, expect, it } from "vitest";
import { localizedPath, pageMetadata } from "./seo";

describe("SEO", () => {
  it("chemins localisés", () => {
    expect(localizedPath("fr", "/")).toBe("/");
    expect(localizedPath("ar", "/")).toBe("/ar");
    expect(localizedPath("en", "/simulateur")).toBe("/en/simulateur");
    expect(localizedPath("fr", "/bailleurs")).toBe("/bailleurs");
  });

  it("canonique, hreflang (dont x-default) et Open Graph", () => {
    process.env.SITE_URL = "https://leaseplace.example/";
    const m = pageMetadata({ locale: "ar", path: "/simulateur", title: "T", description: "D" });
    expect(m.alternates?.canonical).toBe("https://leaseplace.example/ar/simulateur");
    expect(m.alternates?.languages).toEqual({
      fr: "https://leaseplace.example/simulateur",
      ar: "https://leaseplace.example/ar/simulateur",
      en: "https://leaseplace.example/en/simulateur",
      "x-default": "https://leaseplace.example/simulateur",
    });
    expect(m.openGraph).toMatchObject({
      locale: "ar_MA",
      url: "https://leaseplace.example/ar/simulateur",
    });
    delete process.env.SITE_URL;
  });
});
