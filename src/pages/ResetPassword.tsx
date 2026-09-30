/**
 * Réinitialisation du mot de passe : on arrive ici depuis le lien du
 * courriel (session de récupération ouverte par supabase-js, routage par
 * AuthRedirectHandler). Sans session : lien invalide ou expiré.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, KeyRound, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const verifications = {
    minChars: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
  };

  const valider = (): string | null => {
    if (!verifications.minChars) return t("auth.validation.passwordMinLength");
    if (!verifications.uppercase) return t("auth.validation.passwordUppercase");
    if (!verifications.digit) return t("auth.validation.passwordDigit");
    if (password !== confirmation) return t("auth.validation.passwordMismatch");
    return null;
  };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    const probleme = valider();
    setErreur(probleme ?? "");
    if (probleme) return;
    setEnCours(true);
    const { error } = await supabase.auth.updateUser({ password });
    setEnCours(false);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("auth.resetPassword.success") });
    navigate("/dashboard", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {user ? t("auth.resetPassword.title") : t("auth.resetPassword.invalidTitle")}
          </CardTitle>
          <CardDescription>
            {user ? t("auth.resetPassword.subtitle") : t("auth.resetPassword.invalidBody")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user ? (
            <div className="text-center">
              <Button asChild variant="outline">
                <Link to="/forgot-password">{t("auth.resetPassword.requestNew")}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={soumettre} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t("auth.resetPassword.newPassword")}</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={enCours}
                />
                <div className="flex flex-wrap gap-3 text-xs">
                  {(["minChars", "uppercase", "digit"] as const).map((cle) => (
                    <span
                      key={cle}
                      className={`flex items-center gap-1 ${verifications[cle] ? "text-green-600" : "text-muted-foreground"}`}
                    >
                      {verifications[cle] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {t(`auth.validation.${cle}`)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t("auth.fields.confirmPassword")}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  disabled={enCours}
                />
              </div>
              {erreur && <p className="text-sm text-destructive">{erreur}</p>}
              <Button type="submit" className="w-full" disabled={enCours}>
                {enCours ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("auth.resetPassword.saving")}
                  </>
                ) : (
                  t("auth.resetPassword.submit")
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
