/**
 * /auth/verifier — confirmation du courriel hors de l'écran post-inscription :
 * - ?email=… : même écran d'attente qu'après l'inscription (page rechargée) ;
 * - sans adresse : « Vous avez reçu un code de confirmation ? » (adresse +
 *   code), lien présent sur les pages de connexion et d'inscription.
 */
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import AttenteConfirmation from "@/components/auth/AttenteConfirmation";
import ConfirmerAvecCode from "@/components/auth/ConfirmerAvecCode";
import { emailPrerempli } from "@/lib/auth/confirmation";

export default function VerifierCourriel() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = emailPrerempli(location.search);
  const code = new URLSearchParams(location.search).has("code");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardContent className="pt-6">
          {email && !code ? (
            <AttenteConfirmation email={email} onModifier={() => navigate("/signup")} />
          ) : (
            <ConfirmerAvecCode emailInitial={email} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
