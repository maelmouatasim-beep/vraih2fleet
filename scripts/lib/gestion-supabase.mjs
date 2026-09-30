/**
 * API de gestion Supabase (https://api.supabase.com) pour les scripts de
 * déploiement : SUPABASE_ACCESS_TOKEN et SUPABASE_PROJECT_REF viennent des
 * secrets GitHub — jamais du dépôt ni du chat.
 */
const API = "https://api.supabase.com/v1";

export function exigerEnv(nom) {
  const v = process.env[nom];
  if (!v) throw new Error(`${nom} manquant (secret GitHub du dépôt — voir docs/deploiement.md)`);
  return v;
}

export async function api(chemin, options = {}) {
  const r = await fetch(`${API}${chemin}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${exigerEnv("SUPABASE_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`API de gestion ${chemin.replace(/\?.*$/, "")} → HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/** SQL sur la base hébergée (rôle postgres) ; renvoie les lignes. */
export async function sqlHeberge(sql) {
  return api(`/projects/${exigerEnv("SUPABASE_PROJECT_REF")}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query: sql }),
  });
}
