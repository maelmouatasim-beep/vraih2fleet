// En PREMIER : capture le retour des liens de courriel avant que le client
// Supabase ne nettoie l'URL (voir src/lib/authRedirect.ts).
import "./lib/authRedirect";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

createRoot(document.getElementById("root")!).render(<App />);
