/**
 * Page d'attente « Vérifiez vos courriels » accessible par son adresse
 * (/auth/verifier?email=…) : même contenu que l'écran affiché après
 * l'inscription, utile si la page a été rechargée.
 */
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import AttenteConfirmation from "@/components/auth/AttenteConfirmation";
import { emailPrerempli } from "@/lib/auth/confirmation";

export default function VerifierCourriel() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = emailPrerempli(location.search);
  if (!email) return <Navigate to="/signup" replace />;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardContent className="pt-6">
          <AttenteConfirmation email={email} onModifier={() => navigate("/signup")} />
        </CardContent>
      </Card>
    </div>
  );
}
