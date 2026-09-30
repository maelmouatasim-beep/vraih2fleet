import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { lireRetourAuth } from "@/lib/authRedirect";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();
  // Routage par hash : au retour d'un lien de courriel, le HashRouter voit
  // brièvement « /access_token=… » comme une route. Ce n'est pas une 404 :
  // supabase-js lit les jetons puis AuthRedirectHandler redirige. Rien
  // n'est journalisé (le chemin contient des jetons).
  const retourAuth = lireRetourAuth(`#${location.pathname.replace(/^\//, "")}`, "") !== null;

  useEffect(() => {
    if (!retourAuth) console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname, retourAuth]);

  if (retourAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t("notFound.message")}</p>
        <Link to="/" className="text-primary underline hover:text-primary/90">
          {t("notFound.home")}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
