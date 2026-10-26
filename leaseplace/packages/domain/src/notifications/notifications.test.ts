import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  NOTIFICATION_KIND_LIST,
  NOTIFICATION_KINDS,
  channelsFor,
  isNotificationKind,
  normalizeMoroccanMobile,
} from "./notifications";

describe("notifications", () => {
  it("catalogue : chaque type a une audience", () => {
    expect(NOTIFICATION_KIND_LIST.length).toBeGreaterThan(10);
    for (const k of NOTIFICATION_KIND_LIST)
      expect(["company", "lessor"]).toContain(NOTIFICATION_KINDS[k].audience);
    expect(isNotificationKind("offer_received")).toBe(true);
    expect(isNotificationKind("toString")).toBe(false);
  });

  it("e-mail par défaut ; SMS et WhatsApp pour les étapes importantes, avec un numéro", () => {
    expect(channelsFor("offer_received", DEFAULT_PREFERENCES)).toEqual(["email"]);
    const all = { email: true, sms: true, whatsapp: true, phone: "+212612345678" };
    expect(channelsFor("offer_received", all)).toEqual(["email", "sms", "whatsapp"]);
    expect(channelsFor("message_from_lessor", all)).toEqual(["email"]);
    expect(channelsFor("offer_received", { ...all, phone: null })).toEqual(["email"]);
    expect(channelsFor("offer_received", { ...all, email: false, sms: false })).toEqual([
      "whatsapp",
    ]);
  });

  it("WhatsApp désactivé : SMS seul en plus de l'e-mail", () => {
    const prefs = { email: true, sms: true, whatsapp: false, phone: "+212612345678" };
    expect(channelsFor("deal_activated", prefs)).toEqual(["email", "sms"]);
  });

  it("numéro mobile marocain normalisé, fixes et numéros invalides refusés", () => {
    expect(normalizeMoroccanMobile("06 12 34 56 78")).toBe("+212612345678");
    expect(normalizeMoroccanMobile("+212 7-00.11.22.33")).toBe("+212700112233");
    expect(normalizeMoroccanMobile("00212612345678")).toBe("+212612345678");
    expect(normalizeMoroccanMobile("(0)612345678")).toBe("+212612345678");
    expect(normalizeMoroccanMobile("0522123456")).toBeNull();
    expect(normalizeMoroccanMobile("061234567")).toBeNull();
    expect(normalizeMoroccanMobile("")).toBeNull();
  });
});
