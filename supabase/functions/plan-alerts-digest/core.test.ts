import { assertEquals } from "jsr:@std/assert@1";
import { construireEnvois, MAX_ALERTES_PAR_COURRIEL, type AlerteDigest } from "./core.ts";

const alerte = (id: string, severity: AlerteDigest["severity"], project_id = "p1"): AlerteDigest => ({
  id,
  project_id,
  severity,
  title_fr: `Titre ${id}`,
  title_en: `Title ${id}`,
  message_fr: `Message ${id}`,
  message_en: `Message ${id}`,
});
const projets = [{ id: "p1", name: "Transition", user_id: "u-owner", organization_id: "o1" }];
const membres = [
  { organization_id: "o1", user_id: "u-member", role: "member" },
  { organization_id: "o1", user_id: "u-reader", role: "reader" },
  { organization_id: "o2", user_id: "u-other", role: "admin" },
];
const courriels = new Map([
  ["u-owner", "owner@example.com"],
  ["u-member", "member@example.com"],
  ["u-reader", "reader@example.com"],
  ["u-other", "other@example.com"],
]);

Deno.test("plan-alerts-digest : propriétaire + membres de l'organisation, critiques d'abord, sans les infos", () => {
  const envois = construireEnvois(
    [alerte("a1", "attention"), alerte("a2", "info"), alerte("a3", "critique")],
    projets,
    membres,
    new Map(),
    courriels,
  );
  assertEquals(envois.map((e) => e.to), ["member@example.com", "owner@example.com"]);
  assertEquals(envois[0].alerts.map((a) => a.severity), ["critique", "attention"]);
  assertEquals(envois[0].alertIds, ["a3", "a1"]);
});

Deno.test("plan-alerts-digest : préférence désactivée respectée, projet inconnu ignoré, plafond par courriel", () => {
  const nombreuses = Array.from({ length: 25 }, (_, i) => alerte(`x${i}`, "attention"));
  const envois = construireEnvois(
    [...nombreuses, alerte("z", "critique", "p-inconnu")],
    projets,
    membres,
    new Map([["u-member", { plan_alerts: false }]]),
    courriels,
  );
  assertEquals(envois.map((e) => e.to), ["owner@example.com"]);
  assertEquals(envois[0].alerts.length, MAX_ALERTES_PAR_COURRIEL);
});
