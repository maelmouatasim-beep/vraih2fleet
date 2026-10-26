import { describe, expect, it } from "vitest";
import { NOTIFICATION_KIND_LIST, NOTIFICATION_KINDS } from "@leaseplace/domain";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

type Kinds = Record<string, { title?: string; body?: string }>;

/** Les clés de notification sont construites à l'exécution (`kinds.<type>.title`). */
describe.each([
  ["fr", fr],
  ["en", en],
  ["ar", ar],
])("notifications %s", (_name, messages) => {
  const n = messages.notifications;
  const kinds = n.kinds as Kinds;

  it("chaque type a un titre et un texte", () => {
    expect(Object.keys(kinds).sort()).toEqual([...NOTIFICATION_KIND_LIST].sort());
    for (const k of NOTIFICATION_KIND_LIST) {
      expect(kinds[k]?.title, k).toBeTruthy();
      expect(kinds[k]?.body, k).toBeTruthy();
    }
  });

  it("le nom du bailleur n'apparaît que dans les notifications destinées à l'entreprise", () => {
    for (const k of NOTIFICATION_KIND_LIST) {
      const text = `${kinds[k]?.title ?? ""} ${kinds[k]?.body ?? ""}`;
      if (NOTIFICATION_KINDS[k].audience === "lessor") expect(text, k).not.toContain("{lessor}");
      expect(text, k).toContain("{reference}");
    }
  });

  it("gabarits e-mail et SMS : titre (avec la référence), lien et marque", () => {
    for (const v of ["{title}", "{body}", "{url}", "{brand}"]) expect(n.emailBody).toContain(v);
    for (const v of ["{body}", "{url}", "{brand}"]) expect(n.textBody).toContain(v);
  });
});
