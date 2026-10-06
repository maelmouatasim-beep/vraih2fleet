/**
 * « Vous avez reçu un code de confirmation ? » — adresse + code à 6 chiffres,
 * accessible depuis les pages de connexion et d'inscription : pour confirmer
 * son adresse après avoir fermé ou rechargé l'écran d'attente, ou en
 * revenant plus tard. Réponses neutres : une adresse inconnue et un mauvais
 * code donnent le même message ; le renvoi répond toujours la même chose.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KeyRound, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { PAGE_CONFIRMATION } from "@/lib/authRedirect";
import { normaliserCodeOtp, secondesAvantRenvoi } from "@/lib/auth/confirmation";
import { renvoyerConfirmation, verifierCodeConfirmation } from "@/lib/auth/codeConfirmation";

const ADRESSE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function ConfirmerAvecCode({ emailInitial = "" }: { emailInitial?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(emailInitial);
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);
  const [renvoi, setRenvoi] = useState(false);
  const [dernierEnvoi, setDernierEnvoi] = useState<number | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setMaintenant(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const attente = secondesAvantRenvoi(dernierEnvoi, maintenant);
  const adresse = email.trim();

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ADRESSE.test(adresse)) {
      setErreur(t("auth.validation.invalidEmail"));
      return;
    }
    const jeton = normaliserCodeOtp(code);
    if (!jeton) {
      setErreur(t("auth.confirmation.codeFormat"));
      return;
    }
    setErreur(null);
    setVerification(true);
    const ok = await verifierCodeConfirmation(adresse, jeton);
    setVerification(false);
    if (!ok) {
      setErreur(t("auth.confirmation.codeInvalid"));
      return;
    }
    navigate(PAGE_CONFIRMATION, { replace: true });
  };

  const renvoyer = async () => {
    if (!ADRESSE.test(adresse)) {
      setErreur(t("auth.validation.invalidEmail"));
      return;
    }
    setErreur(null);
    setRenvoi(true);
    const issue = await renvoyerConfirmation(adresse);
    setRenvoi(false);
    setDernierEnvoi(Date.now());
    setMaintenant(Date.now());
    toast(
      issue === "trop_de_demandes"
        ? { title: t("auth.confirmation.tooManyTitle"), description: t("auth.confirmation.tooManyBody"), variant: "destructive" }
        : { title: t("auth.confirmation.resentTitle"), description: t("auth.confirmation.resentBody") },
    );
  };

  return (
    <div className="space-y-6" data-testid="code-confirmation">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">{t("auth.confirmation.codePageTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.confirmation.codePageBody")}</p>
      </div>
      <form onSubmit={valider} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code-email">{t("auth.fields.email")}</Label>
          <Input
            id="code-email"
            data-testid="code-email"
            type="email"
            autoComplete="email"
            placeholder={t("auth.placeholders.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={verification}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code-valeur">{t("auth.confirmation.codeLabel")}</Label>
          <Input
            id="code-valeur"
            data-testid="code-value"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={9}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="tracking-widest tabular-nums"
            disabled={verification}
          />
        </div>
        {erreur && (
          <p className="text-sm text-destructive" data-testid="code-error">
            {erreur}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={verification} data-testid="code-submit">
          {verification ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.confirmation.codeSubmit")}
        </Button>
      </form>
      <div className="flex flex-col items-center gap-2 text-sm">
        <Button variant="ghost" onClick={renvoyer} disabled={attente > 0 || renvoi} data-testid="code-resend">
          {renvoi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {attente > 0 ? t("auth.confirmation.resendIn", { count: attente }) : t("auth.confirmation.resend")}
        </Button>
        <Link to="/login" className="text-primary hover:underline">
          {t("auth.confirmation.backToLogin")}
        </Link>
      </div>
    </div>
  );
}
