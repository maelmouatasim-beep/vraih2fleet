// plan-alerts-digest — logique PURE (testée) : regroupe les alertes de
// surveillance actives, non vues et pas encore envoyées, par projet et par
// destinataire (propriétaire du projet + administrateurs et membres de son
// organisation ayant laissé la préférence « plan_alerts » activée).

export interface AlerteDigest {
  id: string;
  project_id: string;
  severity: "critique" | "attention" | "info";
  title_fr: string;
  title_en: string;
  message_fr: string;
  message_en: string;
}
export interface ProjetDigest {
  id: string;
  name: string;
  user_id: string;
  organization_id: string | null;
}
export interface MembreDigest {
  organization_id: string;
  user_id: string;
  role: string;
}
export interface EnvoiDigest {
  to: string;
  projectId: string;
  projectName: string;
  lang: "fr" | "en";
  alerts: { severity: AlerteDigest["severity"]; title: string; message: string }[];
  alertIds: string[];
}

export const MAX_ALERTES_PAR_COURRIEL = 20;
const ORDRE = { critique: 0, attention: 1, info: 2 } as const;

export function construireEnvois(
  alertes: AlerteDigest[],
  projets: ProjetDigest[],
  membres: MembreDigest[],
  /** email_notifications par utilisateur (absent = préférences par défaut). */
  preferences: Map<string, Record<string, unknown> | null>,
  courriels: Map<string, string>,
): EnvoiDigest[] {
  const envois: EnvoiDigest[] = [];
  const parProjet = new Map<string, AlerteDigest[]>();
  for (const a of alertes) {
    if (a.severity === "info") continue;
    parProjet.set(a.project_id, [...(parProjet.get(a.project_id) ?? []), a]);
  }
  for (const [projectId, liste] of parProjet) {
    const projet = projets.find((p) => p.id === projectId);
    if (!projet) continue;
    const destinataires = new Set<string>([projet.user_id]);
    for (const m of membres) {
      if (m.organization_id === projet.organization_id && (m.role === "admin" || m.role === "member")) {
        destinataires.add(m.user_id);
      }
    }
    const triees = [...liste].sort((a, b) => ORDRE[a.severity] - ORDRE[b.severity]).slice(0, MAX_ALERTES_PAR_COURRIEL);
    for (const userId of [...destinataires].sort()) {
      // Préférence par défaut : activée (comme dans Paramètres).
      if (preferences.get(userId)?.plan_alerts === false) continue;
      const to = courriels.get(userId);
      if (!to) continue;
      envois.push({
        to,
        projectId,
        projectName: projet.name.slice(0, 200),
        lang: "fr",
        alerts: triees.map((a) => ({ severity: a.severity, title: a.title_fr, message: a.message_fr })),
        alertIds: triees.map((a) => a.id),
      });
    }
  }
  return envois;
}
