import { describe, expect, it } from "vitest";
import { contactDetails, messageIssues, shouldNotifyMessage, unreadCount } from "./messages";

describe("messages", () => {
  it("vide ou trop long refusé", () => {
    expect(messageIssues("  ")).toEqual(["empty"]);
    expect(messageIssues("Bonjour")).toEqual([]);
    expect(messageIssues("x".repeat(4001))).toEqual(["too_long"]);
    expect(messageIssues(` ${"x".repeat(4000)} `)).toEqual([]);
  });

  it("coordonnées signalées, montants et références ignorés", () => {
    expect(contactDetails("Le devis est de 650 000 DH HT, référence LP-2026-000012.")).toEqual([]);
    expect(contactDetails("Échéance au 15/11/2026, 48 mois, 1 250 000 DH")).toEqual([]);
    expect(contactDetails("Appelez-moi au 06 12 34 56 78")).toEqual(["phone"]);
    expect(contactDetails("+212 661-234-567 ou 0522.12.34.56")).toEqual(["phone"]);
    expect(contactDetails("WhatsApp : 00212700112233")).toEqual(["phone"]);
    expect(contactDetails("depuis la France : +33 6 12 34 56 78")).toEqual(["phone"]);
    expect(contactDetails("Écrivez à k.ziani@revue-sarl.ma")).toEqual(["email"]);
    expect(contactDetails("Voir https://exemple.ma/devis et www.exemple.ma")).toEqual(["url"]);
    expect(contactDetails("contact@exemple.ma, 0612345678, www.exemple.ma")).toEqual([
      "email",
      "phone",
      "url",
    ]);
  });

  it("non lus : messages de l'autre partie après la dernière lecture", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 10, 1, h));
    const messages = [
      { authorOrganizationId: "moi", createdAt: at(8) },
      { authorOrganizationId: "eux", createdAt: at(9) },
      { authorOrganizationId: "eux", createdAt: at(11) },
    ];
    expect(unreadCount(messages, "moi", null)).toBe(2);
    expect(unreadCount(messages, "moi", at(10))).toBe(1);
    expect(unreadCount(messages, "moi", at(11))).toBe(0);
    expect(unreadCount(messages, "eux", null)).toBe(1);
  });
});

describe("notification d'un message", () => {
  const at = (min: number) => new Date(Date.UTC(2026, 10, 1, 9, min));
  it("premier message, réponse ou silence de 30 minutes ; jamais une rafale", () => {
    expect(shouldNotifyMessage(null, "moi", at(0))).toBe(true);
    expect(
      shouldNotifyMessage({ authorOrganizationId: "eux", createdAt: at(0) }, "moi", at(1)),
    ).toBe(true);
    expect(
      shouldNotifyMessage({ authorOrganizationId: "moi", createdAt: at(0) }, "moi", at(10)),
    ).toBe(false);
    expect(
      shouldNotifyMessage({ authorOrganizationId: "moi", createdAt: at(0) }, "moi", at(31)),
    ).toBe(true);
  });
});
