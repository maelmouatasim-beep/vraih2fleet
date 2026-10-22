import { describe, expect, it } from "vitest";
import { leadFormSchema, pgErrorCode } from "./leads";

const valid = {
  kind: "lessor",
  organizationName: "Cèdre Leasing",
  contactName: "Youssef Alaoui",
  email: "y.alaoui@cedre.example",
  phone: "+212 6 00 00 00 00",
  message: "",
  consent: "on",
  locale: "fr",
  website: "",
};

describe("formulaire de contact", () => {
  it("accepte une demande valide ; champs facultatifs vides → null", () => {
    const r = leadFormSchema.parse(valid);
    expect(r.message).toBeNull();
    expect(r.phone).toBe("+212 6 00 00 00 00");
  });
  it("refuse sans consentement, adresse invalide, téléphone fantaisiste ou robot", () => {
    expect(leadFormSchema.safeParse({ ...valid, consent: undefined }).success).toBe(false);
    expect(leadFormSchema.safeParse({ ...valid, email: "x" }).success).toBe(false);
    expect(leadFormSchema.safeParse({ ...valid, phone: "<script>" }).success).toBe(false);
    expect(leadFormSchema.safeParse({ ...valid, website: "spam.example" }).success).toBe(false);
  });
  it("code d'erreur Postgres", () => {
    expect(pgErrorCode({ cause: { code: "P0429" } })).toBe("P0429");
    expect(pgErrorCode({ code: "23514" })).toBe("23514");
  });
});

it("renvoie la saisie au formulaire après une erreur", async () => {
  const { echoValues } = await import("./leads");
  expect(echoValues({ organizationName: "Cèdre", email: "a@b.example", consent: "on" })).toEqual({
    organizationName: "Cèdre",
    contactName: "",
    email: "a@b.example",
    phone: "",
    message: "",
  });
});
