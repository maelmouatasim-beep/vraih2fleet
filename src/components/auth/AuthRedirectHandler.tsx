/**
 * Après un clic sur un lien de courriel (confirmation, réinitialisation),
 * envoie l'utilisateur sur la bonne page une fois la session ouverte.
 * Le retour a été capturé au chargement (src/lib/authRedirect.ts), avant
 * que supabase-js ne vide l'URL.
 */
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { consommerRetourInitial, destinationRetour, type RetourAuth } from "@/lib/authRedirect";

export default function AuthRedirectHandler() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const retour = useRef<RetourAuth | null | undefined>(undefined);
  if (retour.current === undefined) retour.current = consommerRetourInitial();

  useEffect(() => {
    const r = retour.current;
    if (!r || isLoading) return;
    retour.current = null;
    if (r.erreur) {
      toast({ title: t("auth.linkError.title"), description: t("auth.linkError.description"), variant: "destructive" });
    }
    navigate(user || r.erreur ? destinationRetour(r) : "/login", { replace: true });
  }, [isLoading, user, navigate, t]);

  return null;
}
