import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import fr from "@/i18n/locales/fr/translation.json";
import en from "@/i18n/locales/en/translation.json";
import { PROACTIVE_TRIGGERS, evaluateProactiveTriggers } from "@/lib/proactive-triggers";
import { actionsRapides, toutesClesActions, typePage } from "../context";

type Arbre = Record<string, unknown>;
const lire = (arbre: Arbre, chemin: string): unknown =>
  chemin.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Arbre)[k] : undefined), arbre);

function textes(o: unknown): string[] {
  if (typeof o === "string") return [o];
  if (o && typeof o === "object") return Object.values(o).flatMap(textes);
  return [];
}

describe("assistant — pages actuelles (D3)", () => {
  it("reconnaît le menu 6 entrées et les 7 étapes du parcours", () => {
    expect(typePage("/dashboard")).toBe("dashboard");
    expect(typePage("/dashboard/fleet")).toBe("fleet");
    expect(typePage("/dashboard/projects")).toBe("projects");
    expect(typePage("/dashboard/projects/abc/faisabilite")).toBe("journey_faisabilite");
    expect(typePage("/dashboard/projects/abc/suivi/")).toBe("journey_suivi");
    expect(typePage("/dashboard/library")).toBe("library");
    expect(typePage("/dashboard/scenarios/new")).toBe("unknown");
    expect(actionsRapides("unknown").length).toBeGreaterThan(0);
  });

  it("chaque action rapide et chaque déclencheur a son texte en fr ET en en", () => {
    for (const cle of toutesClesActions()) {
      for (const loc of [fr, en] as Arbre[]) {
        expect(lire(loc, `assistant.quick.${cle}.label`), cle).toEqual(expect.any(String));
        expect(lire(loc, `assistant.quick.${cle}.query`), cle).toEqual(expect.any(String));
      }
    }
    for (const t of PROACTIVE_TRIGGERS) {
      expect(lire(fr as Arbre, t.messageKey), t.id).toEqual(expect.any(String));
      expect(lire(en as Arbre, t.messageKey), t.id).toEqual(expect.any(String));
    }
  });

  it("déclencheurs : flotte vide avant projet, puis projet", () => {
    const base = { page_type: "dashboard", current_url: "/dashboard" };
    expect(evaluateProactiveTriggers({ ...base, has_fleet: false }, new Set())?.id).toBe("no_fleet_yet");
    expect(
      evaluateProactiveTriggers({ ...base, has_fleet: true, has_projects: false }, new Set())?.id,
    ).toBe("no_projects_yet");
  });
});

describe("aucun ancien chiffre dans l'aide, les guides et l'assistant (D3)", () => {
  const INTERDITS: RegExp[] = [
    /1[,.]48/, // ancien prix diesel
    /\d[\d\s,.–-]*\s?\$\s?(CAD\s?)?\/\s?(kg|L|kWh)\b/i, // « 12 $/kg », « 0,12 $/kWh »
    /\$\s?\d+(?:[.,]\d+)?\s?\/\s?(kg|L|kWh)\b/i, // « $12.00/kg »
    /\d+\s?[k]?\$\s?(?:par|per)\s?(véhicule|borne|station|vehicle|charger)/i,
    /iMHZEV[^.]*(offre|jusqu)/i, // programme fermé présenté comme ouvert
    /\d[\d\s,.–-]*\s?\$\s?(?:par|per)\s?(camion|truck)/i, // « 200 000 $ par camion »
    /\d[\d\s,.–-]*\s?\$\s?\/\s?km\b/i, // « 1,20-1,50 $/km »
    /(iVMLZE|iMHZEV|ZEVIP|PIVEZ)\s?:\s?[^.]*\d/i, // montant ou % accolé à un programme
  ];
  const sources: [string, string[]][] = [
    ["fr.helpTraining", textes((fr as Arbre).helpTraining)],
    ["en.helpTraining", textes((en as Arbre).helpTraining)],
    ["fr.guides", textes((fr as Arbre).guides)],
    ["en.guides", textes((en as Arbre).guides)],
    ["fr.assistant", textes((fr as Arbre).assistant)],
    ["en.assistant", textes((en as Arbre).assistant)],
    ["assistant-chat", [readFileSync(resolve(__dirname, "../../../../supabase/functions/assistant-chat/index.ts"), "utf8")]],
    ["proactive-triggers", [readFileSync(resolve(__dirname, "../../proactive-triggers.ts"), "utf8")]],
  ];

  it.each(sources)("%s ne contient aucun prix ou montant figé", (_nom, liste) => {
    for (const texte of liste) {
      for (const motif of INTERDITS) {
        expect(texte, `motif ${motif} dans « ${texte.slice(0, 120)} »`).not.toMatch(motif);
      }
    }
  });

  it("l'assistant ne prétend jamais que la télématique alimente Ma flotte automatiquement", () => {
    const kb = readFileSync(resolve(__dirname, "../../../../supabase/functions/assistant-chat/index.ts"), "utf8");
    expect(kb).not.toMatch(/télématique[^.]{0,60}peut alimenter/i);
    expect(kb).toMatch(/ne modifie JAMAIS Ma flotte automatiquement/);
  });
});
