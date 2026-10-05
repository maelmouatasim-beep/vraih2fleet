import { describe, expect, it } from "vitest";
import { adresseValide, issueCourrielTest } from "../courrielTest";

describe("courriel de test : issue affichée", () => {
  it("succès, service non branché, erreurs SMTP classées", () => {
    expect(issueCourrielTest(200, { success: true })).toBe("envoye");
    expect(issueCourrielTest(503, { error: "service_non_configure" })).toBe("non_configure");
    expect(issueCourrielTest(502, { error: "smtp_auth" })).toBe("smtp_auth");
    expect(issueCourrielTest(502, { error: "smtp_connexion" })).toBe("smtp_connexion");
    expect(issueCourrielTest(502, { error: "smtp_refus" })).toBe("smtp_refus");
  });
  it("accès refusé, débit, réponse inattendue", () => {
    expect(issueCourrielTest(403, { error: "x" })).toBe("interdit");
    expect(issueCourrielTest(429, null)).toBe("trop_de_demandes");
    expect(issueCourrielTest(502, { error: "autre" })).toBe("echec");
    expect(issueCourrielTest(500, "texte")).toBe("echec");
    expect(issueCourrielTest(503, { error: "autre" })).toBe("echec");
  });
  it("adresse saisie", () => {
    expect(adresseValide(" moi@exemple.ca ")).toBe(true);
    expect(adresseValide("pas une adresse")).toBe(false);
    expect(adresseValide("a@b")).toBe(false);
  });
});
