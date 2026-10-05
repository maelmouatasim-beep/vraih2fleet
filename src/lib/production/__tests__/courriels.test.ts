/** Courriels applicatifs : SMTP IONOS (port 465), un seul interrupteur (SMTP_PASSWORD). */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tachesDuSnippet } from "../../../../scripts/taches-cron.mjs";

const racine = resolve(__dirname, "../../../..");
const lire = (f: string) => readFileSync(resolve(racine, f), "utf8");

describe("courriels prêts à activer", () => {
  it("invitation d'équipe : courriel demandé juste après la création, statut affiché", () => {
    const s = lire("src/components/organization/TeamCard.tsx");
    expect(s).toMatch(/const id = await inviteMember\([^)]*\);\s*const envoi = await envoyerInvitationParCourriel\(id,/);
    expect(s).toContain("organization.team.emailStatus.");
    for (const lang of ["fr", "en"]) {
      const d = JSON.parse(lire(`src/i18n/locales/${lang}/translation.json`));
      expect(Object.keys(d.organization.team.emailStatus).sort()).toEqual(["echec", "envoye", "non_configure"]);
    }
  });

  it("préférences de courriel : statut lu sur le serveur, plus de drapeau de build", () => {
    expect(lire("src/pages/Settings.tsx")).not.toContain("VITE_EMAILS_ACTIVE");
    expect(lire("src/pages/Settings.tsx")).toContain("courrielsActifs");
    expect(lire(".github/workflows/deploy-pages.yml")).not.toContain("VITE_EMAILS_ACTIVE");
  });

  it("send-email : gabarit organization_invite, expéditeur du domaine, liens adaptés au site", () => {
    const s = lire("supabase/functions/send-email/index.ts");
    expect(s).toContain('templateType: z.literal("organization_invite")');
    expect(lire("supabase/functions/_shared/smtpConfig.ts")).toContain('"noreply@h2fleet.ca"');
    expect(s).not.toContain("h2fleet.app");
    expect(s).not.toContain("/dashboard/tasks?project=");
    expect(s).toContain('if (req.method === "GET")');
  });

  it("SMTP IONOS : port 465 seulement, plus aucune dépendance à SendGrid", () => {
    const config = lire("supabase/functions/_shared/smtpConfig.ts");
    expect(config).toContain("PORTS_BLOQUES = [25, 587]");
    expect(config).toContain('lire("SMTP_PASSWORD")');
    expect(config).toContain('"smtp.ionos.com"');
    for (const f of [
      "supabase/functions/send-email/index.ts",
      "supabase/functions/plan-alerts-digest/index.ts",
      "supabase/functions/_shared/smtp.ts",
      ".env.example",
      "docs/courriels.md",
      "docs/deploiement.md",
      "scripts/verifier-base.mjs",
    ]) {
      expect(lire(f), f).not.toMatch(/SENDGRID_API_KEY|api\.sendgrid\.com/);
    }
  });

  it("courriel de test : administrateurs H2Fleet seulement, côté serveur et à l'écran", () => {
    const s = lire("supabase/functions/send-email/index.ts");
    expect(s).toMatch(/case "test_email": \{\s*const \{ user, supabase: userClient \} = await getUserOrThrow\(req\);\s*const \{ data: admin \} = await userClient\.rpc\("has_role"/);
    expect(lire("src/pages/Settings.tsx")).toMatch(/\{isAdmin && \(\s*<>\s*<Separator \/>\s*<CourrielTest \/>/);
  });

  it("résumé des alertes : tâche pg_cron planifiée par le déploiement dès que le Vault est prêt", () => {
    expect(tachesDuSnippet(lire("supabase/snippets/taches-planifiees.sql"))).toContain("h2fleet-plan-alerts-digest");
    const wf = lire(".github/workflows/deploy-supabase.yml");
    expect(wf.indexOf("node scripts/taches-cron.mjs")).toBeGreaterThan(wf.indexOf("supabase functions deploy"));
    expect(lire("scripts/verifier-base.mjs")).toContain('"h2fleet-plan-alerts-digest"');
  });
});
