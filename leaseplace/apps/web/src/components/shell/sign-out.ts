"use client";

import { authClient } from "@/lib/auth-client";

/** Déconnexion (auditée côté serveur) puis retour à la connexion. */
export async function signOutAndLeave(goTo: (path: string) => void) {
  await authClient.signOut();
  goTo("/connexion");
}
