import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { writeFileSync } from "fs";
import { componentTagger } from "lovable-tagger";
import { fichierEnTetes, fichierRedirections, verifierEnvProduction } from "./src/lib/production/site";

/**
 * Fichiers de l'hébergeur de production (Cloudflare Pages) : `_headers`
 * (CSP construite depuis l'URL Supabase du build) et `_redirects` (301 des
 * anciennes pages). Seulement en BrowserRouter (le site de test GitHub
 * Pages et l'aperçu, en hash routing, les ignorent).
 * `npm run build:prod` (H2FLEET_BUILD_PRODUCTION=1) refuse en plus de
 * construire si la configuration est incomplète : le déploiement précédent
 * reste alors en ligne.
 */
function fichiersHebergeur(env: Record<string, string>): Plugin {
  let sortie = "dist";
  return {
    name: "h2fleet-fichiers-hebergeur",
    apply: "build",
    configResolved(c) {
      sortie = path.resolve(c.root, c.build.outDir);
    },
    buildStart() {
      if (process.env.H2FLEET_BUILD_PRODUCTION !== "1") return;
      const problemes = verifierEnvProduction(env);
      if (problemes.length) {
        this.error(`Build de production refusé :\n- ${problemes.join("\n- ")}\n(voir docs/production.md)`);
      }
    },
    closeBundle() {
      if (env.VITE_PREVIEW_HASH_ROUTER === "true" || !env.VITE_SUPABASE_URL) return;
      writeFileSync(path.join(sortie, "_headers"), fichierEnTetes(env.VITE_SUPABASE_URL));
      writeFileSync(path.join(sortie, "_redirects"), fichierRedirections());
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...pick(process.env) };
  return {
    server: {
      host: "0.0.0.0",
      port: 8080,
    },
    // mcpPlugin retiré : le serveur MCP est reporté (FEATURE_PUBLIC_API) et
    // supabase/functions/mcp/index.ts est maintenant maintenu à la main.
    plugins: [react(), mode === "development" && componentTagger(), fichiersHebergeur(env)].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

function pick(e: NodeJS.ProcessEnv): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(e)) if (k.startsWith("VITE_") && v !== undefined) r[k] = v;
  return r;
}
