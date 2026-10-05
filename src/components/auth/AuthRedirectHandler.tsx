/**
 * Après un clic sur un lien de courriel (confirmation, réinitialisation),
 * envoie l'utilisateur sur la bonne page une fois la session ouverte.
 * Le retour a été capturé au chargement (src/lib/authRedirect.ts), avant
 * que supabase-js ne vide l'URL. Confirmation réussie ou lien en erreur
 * (expiré, déjà utilisé, invalide) → page /auth/confirme, qui explique.
 */
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { consommerRetourInitial, destinationRetour, PAGE_CONFIRMATION, type RetourAuth } from "@/lib/authRedirect";

export interface EtatErreurLien {
  erreurLien: { code: string | null; description: string | null };
}

export default function AuthRedirectHandler() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const retour = useRef<RetourAuth | null | undefined>(undefined);
  if (retour.current === undefined) retour.current = consommerRetourInitial();

  useEffect(() => {
    const r = retour.current;
    if (!r || isLoading) return;
    retour.current = null;
    if (r.erreur || !user) {
      // Lien refusé par Supabase, ou jetons illisibles : page d'erreur claire.
      const etat: EtatErreurLien = { erreurLien: { code: r.code ?? null, description: r.erreur } };
      navigate(PAGE_CONFIRMATION, { replace: true, state: etat });
      return;
    }
    navigate(destinationRetour(r), { replace: true });
  }, [isLoading, user, navigate]);

  return null;
}
