// Drapeaux de fonctionnalités.
//
// L'API publique (page /dashboard/api, webhooks, api-gateway, serveur MCP)
// est reportée : masquée par défaut, activée par VITE_FEATURE_PUBLIC_API=true
// (et FEATURE_PUBLIC_API=true côté edge functions).
export const PUBLIC_API_ENABLED =
  import.meta.env.VITE_FEATURE_PUBLIC_API === "true";
