import { describe, expect, it } from "vitest";
import {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_EVENTS,
  ANALYTICS_FUNNEL,
  CLIENT_ANALYTICS_EVENTS,
  amountBand,
  isAnalyticsEvent,
  isWellFormedEventName,
  sanitizeProperties,
} from "./events";

const PERSONAL = /email|mail|name|nom|phone|tel|ice|address|adresse|amount$|ip/;

describe("catalogue d'événements", () => {
  it("noms objet_action, propriétés sans donnée personnelle", () => {
    for (const name of ANALYTICS_EVENT_NAMES) {
      expect(isWellFormedEventName(name)).toBe(true);
      for (const key of ANALYTICS_EVENTS[name]) expect(key).not.toMatch(PERSONAL);
    }
    expect(isWellFormedEventName("Request.Submitted")).toBe(false);
  });

  it("l'entonnoir et les événements du navigateur sont au catalogue", () => {
    for (const e of [...ANALYTICS_FUNNEL, ...CLIENT_ANALYTICS_EVENTS])
      expect(isAnalyticsEvent(e)).toBe(true);
    expect(isAnalyticsEvent("toString")).toBe(false);
    expect(isAnalyticsEvent(42)).toBe(false);
  });

  it("propriétés filtrées : liste fermée, valeurs simples, textes bornés", () => {
    expect(
      sanitizeProperties("request_submitted", {
        category: "truck",
        amount_band: "1m_2m",
        email: "x@y.ma",
      }),
    ).toEqual({ category: "truck", amount_band: "1m_2m" });
    expect(
      sanitizeProperties("simulator_used", {
        amount_band: "Jean Dupont <x>",
        duration_months: NaN,
      }),
    ).toEqual({});
    expect(sanitizeProperties("offer_submitted", { first: true })).toEqual({ first: true });
    expect(sanitizeProperties("request_routed", { targets: 3 })).toEqual({ targets: 3 });
  });

  it("montants ramenés à des tranches", () => {
    expect(amountBand(100_000)).toBe("lt_250k");
    expect(amountBand(500_000)).toBe("500k_1m");
    expect(amountBand(1_480_000)).toBe("1m_2m");
    expect(amountBand(9_000_000)).toBe("gte_5m");
  });
});
