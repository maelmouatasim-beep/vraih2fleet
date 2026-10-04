// En PREMIER : capture le retour des liens de courriel avant que le client
// Supabase ne nettoie l'URL (voir src/lib/authRedirect.ts).
import "./lib/authRedirect";
import { cheminDepuisHash } from "./lib/production/site";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// Production (URL propres) : un ancien lien « /#/dashboard » devient
// « /dashboard » ; les jetons d'authentification dans le hash sont laissés.
if (import.meta.env.VITE_PREVIEW_HASH_ROUTER !== "true") {
  const chemin = cheminDepuisHash(window.location.hash);
  if (chemin) window.history.replaceState(null, "", `${import.meta.env.BASE_URL.replace(/\/$/, "")}${chemin}`);
}

createRoot(document.getElementById("root")!).render(<App />);
