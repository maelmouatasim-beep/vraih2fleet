/** Point 3 (sécurité) : garde-fous statiques sur le code du dépôt. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fonctionsASupprimer, fonctionsDuDepot, RETIREES } from "../../../../scripts/supprimer-fonctions-retirees.mjs";

const racine = resolve(__dirname, "../../../..");
const lire = (f: string) => readFileSync(resolve(racine, f), "utf8");

function fichiers(dossier: string, ext = /\.(ts|tsx)$/): string[] {
  return readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    if (statSync(p).isDirectory()) return n === "__tests__" || n === "integrations" ? [] : fichiers(p, ext);
    return ext.test(n) ? [p] : [];
  });
}

describe("télématique : le navigateur ne manipule jamais d'identifiants", () => {
  const sources = fichiers(resolve(racine, "src")).map((f) => [f, readFileSync(f, "utf8")] as const);

  it("aucune lecture ni écriture d'encrypted_credentials côté client, sauf le marqueur de déconnexion", () => {
    for (const [f, s] of sources) {
      for (const ligne of s.split("\n")) {
        if (!/encrypted_credentials|encryptedCredentials/.test(ligne) || /^\s*\/\//.test(ligne)) continue;
        expect(ligne, f).toMatch(/encrypted_credentials: 'revoque'/);
      }
    }
  });

  it("telematics_connections jamais lue avec select('*') (la colonne chiffrée resterait exposée)", () => {
    for (const [f, s] of sources) {
      expect(s, f).not.toMatch(/from\('telematics_connections'\)\s*\.select\('\*'\)/);
    }
  });

  it("fetch-telematics-vehicles appelée avec le seul fournisseur", () => {
    const s = lire("src/components/telematics/FleetImportSection.tsx");
    expect(s).toMatch(/invoke\('fetch-telematics-vehicles', \{\s*body: \{ provider \},/);
  });

  it("les fonctions ne renvoient jamais d'identifiants et chiffrent avec _shared/telematicsCrypto.ts", () => {
    const auth = lire("supabase/functions/authenticate-telematics/index.ts");
    expect(auth).not.toMatch(/btoa\(/);
    expect(auth).not.toMatch(/[^_]credentials: /); // aucun champ « credentials » dans les réponses
    expect(auth).toContain("chiffrer(identifiants");
    for (const f of ["fetch-telematics-vehicles", "sync-telematics-data"]) {
      const s = lire(`supabase/functions/${f}/index.ts`);
      expect(s, f).not.toMatch(/atob\(/);
      expect(s, f).toContain("dechiffrer(");
    }
  });
});

describe("edge functions alignées sur _shared/", () => {
  // Exception documentée : API publique par clé (appels serveur à serveur),
  // dormante (404) tant que FEATURE_PUBLIC_API n'est pas activé.
  const EXCEPTIONS_CORS = ["api-gateway"];
  it("aucune fonction ne déclare son propre CORS « * » (hors API publique par clé, dormante)", () => {
    for (const nom of fonctionsDuDepot(resolve(racine, "supabase/functions"))) {
      if (EXCEPTIONS_CORS.includes(nom)) {
        expect(lire(`supabase/functions/${nom}/index.ts`)).toContain("isPublicApiEnabled");
        continue;
      }
      const s = lire(`supabase/functions/${nom}/index.ts`);
      expect(s, nom).not.toMatch(/Access-Control-Allow-Origin['"]?\s*:\s*['"]\*['"]/);
    }
  });

  it("get-mapbox-token : utilisateur vérifié, CORS partagé, jeton public seulement", () => {
    const s = lire("supabase/functions/get-mapbox-token/index.ts");
    expect(s).toContain("getUserOrThrow(req)");
    expect(s).toContain('from "../_shared/cors.ts"');
    expect(s).toContain('startsWith("pk.")');
  });
});

describe("fonctions retirées supprimées par le workflow de déploiement", () => {
  it("assistant-chat et calculate-tco listées ; aucune n'est encore dans le dépôt", () => {
    expect(Object.keys(RETIREES).sort()).toEqual(["assistant-chat", "calculate-tco"]);
    const depot = fonctionsDuDepot(resolve(racine, "supabase/functions"));
    for (const r of Object.keys(RETIREES)) expect(depot).not.toContain(r);
  });

  it("ne supprime que les fonctions retirées ET absentes du dépôt", () => {
    expect(fonctionsASupprimer(["copilot", "assistant-chat", "autre"], RETIREES, ["copilot"])).toEqual(["assistant-chat"]);
    expect(fonctionsASupprimer(["assistant-chat"], RETIREES, ["assistant-chat"])).toEqual([]);
    expect(fonctionsASupprimer([], RETIREES, [])).toEqual([]);
  });

  it("étape présente dans Deploy Supabase, avant le contrôle de santé", () => {
    const wf = lire(".github/workflows/deploy-supabase.yml");
    const etape = wf.indexOf("node scripts/supprimer-fonctions-retirees.mjs");
    expect(etape).toBeGreaterThan(wf.indexOf("supabase functions deploy"));
    expect(etape).toBeLessThan(wf.indexOf("node scripts/verifier-base.mjs --heberge"));
  });

  it("contrôle de santé : accepte h2fleet.ca comme Site URL après la bascule", () => {
    const s = lire("scripts/verifier-base.mjs");
    expect(s).toContain('const URL_PRODUCTION = "https://h2fleet.ca"');
    expect(s).toContain("fonctions-retirees.json");
    expect(s).toContain('"TELEMATICS_ENCRYPTION_KEY"');
  });
});
