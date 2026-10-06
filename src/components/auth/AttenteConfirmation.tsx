/**
 * Attente de la confirmation du courriel (après l'inscription).
 *
 * - Même navigateur (lien ouvert dans un autre onglet) : la session est
 *   détectée (événement d'authentification, synchronisation entre onglets,
 *   vérification au retour du focus et à intervalle court) → entrée
 *   automatique dans l'espace.
 * - Autre appareil : code à 6 chiffres du courriel (verifyOtp) qui connecte
 *   CE navigateur, ou « Me connecter » avec l'adresse préremplie.
 * - Renvoi du courriel avec un délai de 60 s ; réponse toujours neutre
 *   (aucune indication sur l'existence d'un compte).
 * - origine « connexion » : affiché par la page de connexion quand le compte
 *   n'est pas encore confirmé (mot de passe correct, email_not_confirmed) ;
 *   aucun courriel vient d'être envoyé, donc renvoi possible tout de suite.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, MailCheck, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { PAGE_CONFIRMATION } from "@/lib/authRedirect";
import { lienConnexion, normaliserCodeOtp, secondesAvantRenvoi } from "@/lib/auth/confirmation";
import { renvoyerConfirmation, verifierCodeConfirmation } from "@/lib/auth/codeConfirmation";

interface Props {
  email: string;
  /** Revenir au formulaire pour corriger l'adresse. */
  onModifier: () => void;
  /** « inscription » (courriel tout juste envoyé) ou « connexion » (compte non confirmé). */
  origine?: "inscription" | "connexion";
}

const INTERVALLE_VERIFICATION_MS = 3000;

export default function AttenteConfirmation({ email, onModifier, origine = "inscription" }: Props) {
  const depuisConnexion = origine === "connexion";
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, synchroniserSession } = useAuth();
  const [dernierEnvoi, setDernierEnvoi] = useState<number | null>(() => (depuisConnexion ? null : Date.now()));
  const [maintenant, setMaintenant] = useState<number>(() => Date.now());
  const [renvoi, setRenvoi] = useState(false);
  const [code, setCode] = useState("");
  const [erreurCode, setErreurCode] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);
  const entree = useRef(false);

  const entrer = useCallback(() => {
    if (entree.current) return;
    entree.current = true;
    toast({ title: t("auth.confirmation.confirmedTitle"), description: t("auth.confirmation.enteringSpace") });
    navigate("/dashboard", { replace: true });
  }, [navigate, t]);

  // Entrée dans l'espace UNIQUEMENT quand le fournisseur d'auth connaît
  // l'utilisateur : la route protégée lit ce même état. Naviguer dès que la
  // session apparaît dans le stockage (avant le relais de supabase-js entre
  // onglets) menait à la page de connexion — échec CI du 2026-10-05.
  useEffect(() => {
    if (user) entrer();
  }, [user, entrer]);

  // Confirmation dans un autre onglet du même navigateur : on relit la
  // session dans le fournisseur (événement « storage », retour du focus,
  // intervalle court) ; l'effet ci-dessus fait entrer.
  useEffect(() => {
    const verifier = () => void synchroniserSession();
    const auFocus = () => {
      if (document.visibilityState === "visible") verifier();
    };
    window.addEventListener("focus", auFocus);
    window.addEventListener("storage", auFocus);
    document.addEventListener("visibilitychange", auFocus);
    const minuterie = window.setInterval(() => {
      setMaintenant(Date.now());
      if (document.visibilityState === "visible") verifier();
    }, 1000);
    const verifPeriodique = window.setInterval(verifier, INTERVALLE_VERIFICATION_MS);
    verifier();
    return () => {
      window.removeEventListener("focus", auFocus);
      window.removeEventListener("storage", auFocus);
      document.removeEventListener("visibilitychange", auFocus);
      window.clearInterval(minuterie);
      window.clearInterval(verifPeriodique);
    };
  }, [synchroniserSession]);

  const attente = secondesAvantRenvoi(dernierEnvoi, maintenant);

  const renvoyer = async () => {
    setRenvoi(true);
    const issue = await renvoyerConfirmation(email);
    setRenvoi(false);
    setDernierEnvoi(Date.now());
    setMaintenant(Date.now());
    toast(
      issue === "trop_de_demandes"
        ? { title: t("auth.confirmation.tooManyTitle"), description: t("auth.confirmation.tooManyBody"), variant: "destructive" }
        : { title: t("auth.confirmation.resentTitle"), description: t("auth.confirmation.resentBody") },
    );
  };

  const validerCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const jeton = normaliserCodeOtp(code);
    if (!jeton) {
      setErreurCode(t("auth.confirmation.codeFormat"));
      return;
    }
    setErreurCode(null);
    setVerification(true);
    const ok = await verifierCodeConfirmation(email, jeton);
    setVerification(false);
    if (!ok) {
      setErreurCode(t("auth.confirmation.codeInvalid"));
      return;
    }
    entree.current = true;
    navigate(PAGE_CONFIRMATION, { replace: true });
  };

  return (
    <div className="space-y-6" data-testid="signup-confirmation" data-origine={origine} role="status">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">{t(depuisConnexion ? "auth.confirmation.unconfirmedTitle" : "auth.confirmation.waitTitle")}</h2>
        <p className="text-sm text-muted-foreground" data-testid="confirmation-email">
          {t(depuisConnexion ? "auth.confirmation.unconfirmedBody" : "auth.confirmation.waitBody", { email })}
        </p>
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground" data-testid="confirmation-watching">
          <Loader2 className="h-3 w-3 animate-spin" /> {t("auth.confirmation.watching")}
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium">{t(depuisConnexion ? "auth.confirmation.enterCodeTitle" : "auth.confirmation.otherDeviceTitle")}</p>
        <form onSubmit={validerCode} className="space-y-2">
          <Label htmlFor="otp-code">{t("auth.confirmation.codeLabel")}</Label>
          <div className="flex gap-2">
            <Input
              id="otp-code"
              data-testid="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={9}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="tracking-widest tabular-nums"
              disabled={verification}
            />
            <Button type="submit" disabled={verification} data-testid="otp-submit">
              {verification ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.confirmation.codeSubmit")}
            </Button>
          </div>
          {erreurCode && (
            <p className="text-sm text-destructive" data-testid="otp-error">
              {erreurCode}
            </p>
          )}
        </form>
        {!depuisConnexion && (
          <>
            <p className="text-xs text-muted-foreground">{t("auth.confirmation.orSignIn")}</p>
            <Button variant="outline" className="w-full" onClick={() => navigate(lienConnexion(email))} data-testid="confirmation-login">
              {t("auth.confirmation.signIn")}
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 text-sm">
        <Button variant="ghost" onClick={renvoyer} disabled={attente > 0 || renvoi} data-testid="confirmation-resend">
          {renvoi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {attente > 0 ? t("auth.confirmation.resendIn", { count: attente }) : t("auth.confirmation.resend")}
        </Button>
        <button type="button" className="text-primary hover:underline" onClick={onModifier} data-testid="confirmation-change-email">
          {t("auth.confirmation.changeEmail")}
        </button>
      </div>
    </div>
  );
}
