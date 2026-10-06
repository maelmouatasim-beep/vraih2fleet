/**
 * Confirmation du courriel par le code à 6 chiffres, et renvoi du courriel —
 * partagés par l'écran d'attente (après l'inscription ou une connexion sur
 * un compte non confirmé) et la page « Vous avez reçu un code ? ».
 * Réponses toujours neutres : rien ne révèle si une adresse a un compte.
 */
import { supabase } from "@/integrations/supabase/client";
import { PAGE_CONFIRMATION, urlRetourAuth } from "@/lib/authRedirect";
import { issueRenvoi } from "@/lib/auth/confirmation";

/** Vrai si le code confirme l'adresse (ce navigateur est alors connecté). */
export async function verifierCodeConfirmation(email: string, jeton: string): Promise<boolean> {
  // « email » couvre la confirmation d'inscription ; « signup » en repli
  // pour les projets configurés à l'ancienne.
  let { error } = await supabase.auth.verifyOtp({ email, token: jeton, type: "email" });
  if (error) ({ error } = await supabase.auth.verifyOtp({ email, token: jeton, type: "signup" }));
  return !error;
}

/** Renvoie le courriel de confirmation (lien + code). */
export async function renvoyerConfirmation(email: string): Promise<ReturnType<typeof issueRenvoi>> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: urlRetourAuth(PAGE_CONFIRMATION) },
  });
  return issueRenvoi(error);
}
