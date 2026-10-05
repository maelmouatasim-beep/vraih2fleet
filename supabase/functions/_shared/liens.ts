// Liens vers l'application dans les courriels : URL propres en production
// (h2fleet.ca, BrowserRouter) ; « #/route » sur le site de test GitHub
// Pages (hash routing), où « /route » répondrait 404.
export function lienApplication(base: string, chemin: string): string {
  const racine = base.replace(/\/+$/, "");
  const route = chemin.startsWith("/") ? chemin : `/${chemin}`;
  return /\.github\.io(\/|$)/.test(racine) ? `${racine}/#${route}` : `${racine}${route}`;
}
