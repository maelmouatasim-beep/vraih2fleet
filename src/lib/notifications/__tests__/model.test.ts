import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import i18next from "i18next";
import fr from "@/i18n/locales/fr/translation.json";
import { ETAPES_PARCOURS } from "@/lib/journey/steps";
import en from "@/i18n/locales/en/translation.json";
import {
  CATEGORIES,
  NOTIFICATION_TYPES,
  categorieNotification,
  compterNonLues,
  graviteNotification,
  lienNotification,
  lirePreferences,
  texteNotification,
  type NotificationRow,
} from "../model";

const RACINE = join(__dirname, "../../../..");
const PROJET = "11111111-2222-3333-4444-555555555555";

function notif(type: string, extra: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: `n-${type}`,
    user_id: "u1",
    type,
    title: "Titre enregistré",
    message: "Message enregistré",
    project_id: PROJET,
    related_id: "r1",
    actor_id: "a1",
    is_read: false,
    created_at: "2026-10-03T12:00:00Z",
    archived_at: null,
    payload: { v: 1, project: "Ville de Rivière-Claire", actor: "Jeanne Tremblay", subject: "Remplacer U-12", role: "editor", count: 7 },
    ...extra,
  };
}

async function traducteur(langue: "fr" | "en") {
  const inst = i18next.createInstance();
  await inst.init({
    lng: langue,
    resources: { fr: { translation: fr }, en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  return (k: string, v?: Record<string, unknown>) => inst.t(k, v) as string;
}

/** Routes déclarées dans src/App.tsx, étapes du parcours développées. */
function routesDeclarees(): RegExp[] {
  const app = readFileSync(join(RACINE, "src/App.tsx"), "utf8");
  const etapes: string[] = [...ETAPES_PARCOURS];
  expect(etapes).toContain("suivi");
  const chemins = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== "*");
  chemins.push(...etapes.map((e) => `/dashboard/projects/:projectId/${e}`));
  // Routes qui ne font que rediriger ailleurs : interdites comme cible.
  const redirections = new Set(
    [...app.matchAll(/path="([^"]+)" element=\{<(?:Navigate|TacheVersSuivi|ScenarioVersStrategies|ProjetVersParcours)/g)].map((m) => m[1]),
  );
  return chemins
    .filter((p) => !redirections.has(p))
    .map((p) => new RegExp(`^${p.replace(/:[a-zA-Z]+/g, "[^/?]+")}(\\?.*)?$`));
}

describe("notifications — modèle", () => {
  it("couvre exactement les types autorisés par la contrainte CHECK de la base", () => {
    const migration = readFileSync(join(RACINE, "supabase/migrations/20261006010000_notifications_unifiees.sql"), "utf8");
    const check = migration.match(/notifications_type_check\s+CHECK \(type IN \(([^)]+)\)\)/)?.[1] ?? "";
    const types = [...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(types).toEqual([...NOTIFICATION_TYPES].sort());
  });

  it("chaque type a une catégorie (identique à notification_category en base) et un texte fr ET en", async () => {
    const migration = readFileSync(join(RACINE, "supabase/migrations/20261006010000_notifications_unifiees.sql"), "utf8");
    for (const type of NOTIFICATION_TYPES) {
      const cat = categorieNotification(type);
      expect(CATEGORIES).toContain(cat);
      const ligne = migration.split("\n").find((l) => l.includes("WHEN _type") && l.includes(`'${type}'`));
      expect(ligne, type).toContain(`THEN '${cat}'`);
    }
    for (const langue of ["fr", "en"] as const) {
      const t = await traducteur(langue);
      for (const type of NOTIFICATION_TYPES) {
        const { titre, message } = texteNotification(notif(type, type === "plan_alert" ? { payload: { title_fr: "Échéance PAVÉ", title_en: "PAVÉ deadline", message_fr: "Bientôt", message_en: "Soon" } } : {}), t, langue, "u1");
        expect(titre, `${langue}/${type}`).not.toMatch(/notifications\.|undefined|\{\{/);
        expect(message, `${langue}/${type}`).not.toMatch(/notifications\.|undefined|\{\{/);
        expect(titre.length).toBeGreaterThan(2);
      }
    }
  });

  it("textes dans la langue de l'interface, paramètres de payload interpolés", async () => {
    const tfr = await traducteur("fr");
    const ten = await traducteur("en");
    const n = notif("task_assigned");
    expect(texteNotification(n, tfr, "fr").message).toContain("«\u00a0Remplacer U-12\u00a0»");
    expect(texteNotification(n, tfr, "fr").message).toContain("Ville de Rivière-Claire");
    expect(texteNotification(n, ten, "en").titre).toBe("New task assigned");
    expect(texteNotification(notif("invitation"), tfr, "fr").message).toContain("éditeur");
    // Alerte du plan : textes fr/en rendus par le moteur.
    const alerte = notif("plan_alert", { payload: { title_fr: "Échéance", title_en: "Deadline", message_fr: "fr", message_en: "en", kind: "echeance_subvention" } });
    expect(texteNotification(alerte, ten, "en-CA")).toEqual({ titre: "Deadline", message: "en" });
    expect(texteNotification(alerte, tfr, "fr-CA")).toEqual({ titre: "Échéance", message: "fr" });
  });

  it("tâches générées : « Vous » pour l'auteur, le nom pour l'équipe", async () => {
    const t = await traducteur("fr");
    const n = notif("tasks_generated", { actor_id: "moi" });
    expect(texteNotification(n, t, "fr", "moi").message).toMatch(/^Vous avez généré 7 tâche/);
    expect(texteNotification(n, t, "fr", "autre").message).toMatch(/^Jeanne Tremblay a généré 7 tâche/);
  });

  it("paramètres manquants → formulation neutre traduite ; type inconnu → textes enregistrés, sans planter", async () => {
    const t = await traducteur("en");
    const vide = texteNotification(notif("comment", { payload: { v: 1 } }), t, "en");
    expect(vide.message).toBe("A team member commented on the project “a project”.");
    expect(texteNotification(notif("type_futur"), t, "en")).toEqual({ titre: "Titre enregistré", message: "Message enregistré" });
    expect(texteNotification(notif("comment", { payload: null }), t, "en").titre).toBe("Titre enregistré");
    expect(categorieNotification("type_futur")).toBe("other");
  });

  it("chaque lien vise une route EXISTANTE du parcours (jamais une route retirée ni une redirection)", () => {
    const routes = routesDeclarees();
    const kinds = ["echeance_subvention", "programme_modifie", "capacite_garage", "remplacement_retard", "donnees_energie", "inconnu"];
    const cas: NotificationRow[] = [
      ...NOTIFICATION_TYPES.map((t) => notif(t)),
      ...NOTIFICATION_TYPES.map((t) => notif(t, { project_id: null })),
      ...kinds.map((k) => notif("plan_alert", { payload: { kind: k } })),
      notif("type_futur"),
    ];
    for (const n of cas) {
      const lien = lienNotification(n);
      if (lien === null) continue;
      expect(routes.some((r) => r.test(lien)), `${n.type} → ${lien}`).toBe(true);
      expect(lien).not.toMatch(/\/tasks|\/roadmap|\/compare|\/scenarios/);
    }
  });

  it("navigation par type : tâche → Suivi, subvention → Financement, commentaire → panneau Commentaires", () => {
    const p = `/dashboard/projects/${PROJET}`;
    expect(lienNotification(notif("task_assigned"))).toBe(`${p}/suivi`);
    expect(lienNotification(notif("task_mentioned"))).toBe(`${p}/suivi`);
    expect(lienNotification(notif("milestone_assigned"))).toBe(`${p}/suivi`);
    expect(lienNotification(notif("tasks_generated"))).toBe(`${p}/suivi`);
    expect(lienNotification(notif("subsidy"))).toBe(`${p}/financement`);
    expect(lienNotification(notif("plan_alert", { payload: { kind: "echeance_subvention" } }))).toBe(`${p}/financement`);
    expect(lienNotification(notif("plan_alert", { payload: { kind: "programme_modifie" } }))).toBe(`${p}/financement`);
    expect(lienNotification(notif("plan_alert", { payload: { kind: "capacite_garage" } }))).toBe(`${p}/plan`);
    expect(lienNotification(notif("plan_alert", { payload: { kind: "remplacement_retard" } }))).toBe(`${p}/suivi`);
    expect(lienNotification(notif("comment"))).toBe(`${p}/flotte?partage=comments`);
    expect(lienNotification(notif("version"))).toBe(`${p}/flotte?partage=versions`);
    expect(lienNotification(notif("role_change"))).toBe("/dashboard/organization");
    expect(lienNotification(notif("invitation", { project_id: null }))).toBe("/dashboard/organization");
    expect(lienNotification(notif("task_assigned", { project_id: null }))).toBeNull();
  });

  it("compteur de non-lues : non lues ET non archivées", () => {
    expect(
      compterNonLues([
        { is_read: false, archived_at: null },
        { is_read: false, archived_at: "2026-10-01T00:00:00Z" },
        { is_read: true, archived_at: null },
        { is_read: false },
      ]),
    ).toBe(2);
  });

  it("préférences : tout activé par défaut, seul false désactive", () => {
    expect(lirePreferences(null)).toEqual({ comments: true, tasks: true, team: true, versions: true, plan_alerts: true });
    expect(lirePreferences({ tasks: false, comments: "non" }).tasks).toBe(false);
    expect(lirePreferences({ tasks: false, comments: "non" }).comments).toBe(true);
  });

  it("gravité d'une alerte du plan", () => {
    expect(graviteNotification(notif("plan_alert", { payload: { severity: "critique" } }))).toBe("critique");
    expect(graviteNotification(notif("comment"))).toBeNull();
  });
});
