/**
 * Production (h2fleet.ca, Cloudflare Pages) — module PUR, testé, partagé
 * par le routeur (App.tsx), le build (vite.config.ts) et le serveur local
 * qui imite l'hébergeur (scripts/serveur-production.mjs).
 *
 * - Redirections permanentes des anciennes pages publiques : une seule
 *   liste, rendue côté serveur (fichier `_redirects`, 301) ET côté client
 *   (<Navigate>), pour que les deux ne divergent jamais.
 * - En-têtes HTTP de sécurité (fichier `_headers`) : CSP stricte construite
 *   depuis l'URL Supabase du build — seul serveur externe appelé par le
 *   navigateur (les API tierces passent par les edge functions).
 * - Pas de règle « /* /index.html 200 » : sans 404.html à la racine,
 *   Cloudflare Pages sert index.html pour toute route inconnue (mode SPA),
 *   et une telle règle provoque une boucle (Pages redirige /index.html
 *   vers /).
 */

export const DOMAINE_PRODUCTION = "h2fleet.ca";
export const URL_PRODUCTION = `https://${DOMAINE_PRODUCTION}`;

export interface Redirection {
  de: string;
  vers: string;
}

/** Anciennes pages publiques retirées (refonte, Phase 4). */
export const REDIRECTIONS_PUBLIQUES: readonly Redirection[] = [
  { de: "/ecosystem", vers: "/features" },
  { de: "/calculator", vers: "/features" },
  { de: "/roadmap", vers: "/" },
  { de: "/changelog", vers: "/" },
  { de: "/docs", vers: "/guides" },
  { de: "/api", vers: "/" },
  { de: "/careers", vers: "/" },
  { de: "/press", vers: "/" },
  { de: "/support", vers: "/dashboard/help" },
];

/**
 * /dashboard/roadmap (page retirée) → étape « Suivi » du projet le plus
 * récemment modifié (liste déjà triée par date de modification), sinon la
 * liste des projets.
 */
export function cibleRoadmap(projetsParModificationDecroissante: readonly { id: string }[]): string {
  const p = projetsParModificationDecroissante[0];
  return p ? `/dashboard/projects/${encodeURIComponent(p.id)}/suivi` : "/dashboard/projects";
}

/** Contenu du fichier `_redirects` (Cloudflare Pages / Netlify). */
export function fichierRedirections(liste: readonly Redirection[] = REDIRECTIONS_PUBLIQUES): string {
  const lignes = liste.map((r) => `${r.de}  ${r.vers}  301`);
  return `# Généré au build (src/lib/production/site.ts) — ne pas éditer dist/_redirects.\n${lignes.join("\n")}\n`;
}

/** Origine (schéma + hôte) de l'URL Supabase ; erreur si invalide. */
export function origineSupabase(supabaseUrl: string): { https: string; wss: string } {
  const u = new URL(supabaseUrl);
  if (u.protocol !== "https:" && u.hostname !== "127.0.0.1" && u.hostname !== "localhost") {
    throw new Error(`URL Supabase non HTTPS : ${supabaseUrl}`);
  }
  const ws = u.protocol === "https:" ? "wss:" : "ws:";
  return { https: u.origin, wss: `${ws}//${u.host}` };
}

/**
 * Politique de sécurité du contenu. Aucun 'unsafe-eval' ; 'wasm-unsafe-eval'
 * seulement pour le moteur de mise en page des PDF (WebAssembly) ;
 * 'unsafe-inline' sur les styles seulement (attributs style de Radix,
 * Recharts, react-pdf).
 */
export function politiqueCsp(supabaseUrl: string): string {
  const s = origineSupabase(supabaseUrl);
  const directives: [string, string][] = [
    ["default-src", "'self'"],
    ["script-src", "'self' 'wasm-unsafe-eval'"],
    ["style-src", "'self' 'unsafe-inline'"],
    ["img-src", "'self' data: blob:"],
    ["font-src", "'self' data:"],
    ["connect-src", `'self' ${s.https} ${s.wss} blob: data:`],
    ["worker-src", "'self' blob:"],
    ["frame-src", "'self' blob:"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
  ];
  return directives.map(([k, v]) => `${k} ${v}`).join("; ");
}

/** En-têtes appliqués à toutes les réponses. */
export function enTetesCommuns(supabaseUrl: string): Record<string, string> {
  return {
    "Content-Security-Policy": politiqueCsp(supabaseUrl),
    // Sans « preload » : réversible tant que le domaine n'est pas éprouvé.
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
}

/** Contenu du fichier `_headers` (format Cloudflare Pages). */
export function fichierEnTetes(supabaseUrl: string): string {
  const communs = Object.entries(enTetesCommuns(supabaseUrl))
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");
  return [
    "# Généré au build (src/lib/production/site.ts) — ne pas éditer dist/_headers.",
    "/*",
    communs,
    // Fichiers fingerprintés par Vite : cache d'un an, immuable.
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n");
}

/**
 * Vérifie l'environnement d'un build de PRODUCTION ; renvoie la liste des
 * problèmes (vide = ok). Un build qui échoue laisse en ligne le déploiement
 * précédent : un site mal configuré n'est jamais publié.
 */
export function verifierEnvProduction(env: Record<string, string | undefined>): string[] {
  const problemes: string[] = [];
  const url = env.VITE_SUPABASE_URL;
  const ref = env.VITE_SUPABASE_PROJECT_ID;
  const cle = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url) problemes.push("VITE_SUPABASE_URL manquante");
  if (!ref) problemes.push("VITE_SUPABASE_PROJECT_ID manquante");
  if (!cle) problemes.push("VITE_SUPABASE_PUBLISHABLE_KEY manquante");
  if (url && ref && url.replace(/\/+$/, "") !== `https://${ref}.supabase.co`) {
    problemes.push(`VITE_SUPABASE_URL (${url}) ne correspond pas à VITE_SUPABASE_PROJECT_ID (${ref})`);
  }
  if (cle && /^(PLACEHOLDER|changeme|xxx)/i.test(cle)) problemes.push("VITE_SUPABASE_PUBLISHABLE_KEY est un exemple");
  // Une clé secrète ne doit JAMAIS finir dans le bundle public.
  if (cle && (/^sb_secret_/.test(cle) || roleJwt(cle) === "service_role")) {
    problemes.push("VITE_SUPABASE_PUBLISHABLE_KEY est une clé SECRÈTE (service_role) : refusée");
  }
  if (env.VITE_PREVIEW_HASH_ROUTER === "true") {
    problemes.push("VITE_PREVIEW_HASH_ROUTER=true : la production utilise des URL propres (BrowserRouter)");
  }
  return problemes;
}

function roleJwt(jeton: string): string | null {
  const parties = jeton.split(".");
  if (parties.length !== 3) return null;
  try {
    const json = JSON.parse(atob(parties[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

/**
 * Anciennes URL à hash (« h2fleet.ca/#/dashboard », liens copiés depuis le
 * site de test) → chemin propre, en BrowserRouter. Renvoie null si le hash
 * n'est pas une route (ancre, jetons d'authentification renvoyés par
 * Supabase, erreur de lien) : il est alors laissé intact.
 */
export function cheminDepuisHash(hash: string): string | null {
  if (!/^#\/[A-Za-z]/.test(hash)) return null;
  if (/(^|[#&?/])(access_token|refresh_token|error|error_description|type)=/.test(hash)) return null;
  const chemin = hash.slice(1);
  if (chemin.startsWith("//")) return null; // jamais une URL vers un autre hôte
  return chemin;
}
