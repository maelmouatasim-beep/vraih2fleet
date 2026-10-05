/**
 * Arrivée d'un lien de confirmation de courriel (/auth/confirme).
 * - Succès : « Adresse confirmée » pendant 2,5 s, puis l'espace (l'accueil
 *   ouvre l'assistant de profil à la première connexion), avec un bouton
 *   pour ne pas attendre.
 * - Erreur (lien expiré, déjà utilisé ou invalide) : message clair et
 *   renvoi d'un lien ; jamais d'écran blanc ni de texte technique, et
 *   aucune indication sur l'existence d'un compte.
 */
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { EtatErreurLien } from "@/components/auth/AuthRedirectHandler";
import { PAGE_CONFIRMATION, urlRetourAuth } from "@/lib/authRedirect";
import { DELAI_REDIRECTION_MS, issueRenvoi, secondesAvantRenvoi, typeErreurLien } from "@/lib/auth/confirmation";

export default function ConfirmationCourriel() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const erreurLien = (location.state as EtatErreurLien | null)?.erreurLien ?? null;

  let contenu: JSX.Element;
  if (erreurLien) contenu = <ErreurLien code={erreurLien.code} description={erreurLien.description} />;
  else if (isLoading) contenu = <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />;
  else if (user) contenu = <Confirmee />;
  else contenu = <ErreurLien code={null} description={null} />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-0 shadow-xl">{contenu}</Card>
    </div>
  );
}

function Confirmee() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useEffect(() => {
    const id = window.setTimeout(() => navigate("/dashboard", { replace: true }), DELAI_REDIRECTION_MS);
    return () => window.clearTimeout(id);
  }, [navigate]);
  return (
    <>
      <CardHeader className="text-center" data-testid="email-confirmed">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">{t("auth.confirmation.confirmedTitle")}</CardTitle>
        <CardDescription className="text-base">{t("auth.confirmation.redirecting")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <Button onClick={() => navigate("/dashboard", { replace: true })} data-testid="go-to-space">
          {t("auth.confirmation.goToSpace")}
        </Button>
      </CardContent>
    </>
  );
}

function ErreurLien({ code, description }: { code: string | null; description: string | null }) {
  const { t } = useTranslation();
  const type = typeErreurLien(code, description);
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [dernierEnvoi, setDernierEnvoi] = useState<number | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setMaintenant(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const attente = secondesAvantRenvoi(dernierEnvoi, maintenant);

  const renvoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast({ title: t("auth.validation.invalidEmail"), variant: "destructive" });
      return;
    }
    setEnvoi(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: urlRetourAuth(PAGE_CONFIRMATION) },
    });
    setEnvoi(false);
    setDernierEnvoi(Date.now());
    setMaintenant(Date.now());
    toast(
      issueRenvoi(error) === "trop_de_demandes"
        ? { title: t("auth.confirmation.tooManyTitle"), description: t("auth.confirmation.tooManyBody"), variant: "destructive" }
        : { title: t("auth.confirmation.resentTitle"), description: t("auth.confirmation.resentBody") },
    );
  };

  return (
    <>
      <CardHeader className="text-center" data-testid="link-error" data-type={type}>
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">{t(`auth.confirmation.error.${type}.title`)}</CardTitle>
        <CardDescription className="text-base">{t(`auth.confirmation.error.${type}.body`)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={renvoyer} className="space-y-2">
          <Label htmlFor="resend-email">{t("auth.fields.email")}</Label>
          <Input
            id="resend-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.placeholders.email")}
            data-testid="resend-email"
          />
          <Button type="submit" className="w-full" disabled={envoi || attente > 0} data-testid="resend-link">
            {envoi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {attente > 0 ? t("auth.confirmation.resendIn", { count: attente }) : t("auth.confirmation.resendLink")}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.confirmation.alreadyConfirmed")}{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t("auth.confirmation.signIn")}
          </Link>
        </p>
      </CardContent>
    </>
  );
}
