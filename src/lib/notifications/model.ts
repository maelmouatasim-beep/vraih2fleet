/**
 * Modèle PUR des notifications (aucun accès réseau, testé) : types connus,
 * catégories (mêmes que public.notification_category en base), écran
 * cible de chaque notification et textes dans la langue de l'interface.
 *
 * Règle : un type inconnu ne casse jamais rien — repli sur les textes
 * enregistrés, catégorie « other », lien vers le projet s'il existe.
 */

/** Types autorisés par la contrainte CHECK de public.notifications. */
export const NOTIFICATION_TYPES = [
  "comment",
  "reply",
  "invitation",
  "version",
  "role_change",
  "task_assigned",
  "task_mentioned",
  "milestone_assigned",
  "collaboration_accepted",
  "subsidy",
  "plan_alert",
  "tasks_generated",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const CATEGORIES = ["comments", "tasks", "team", "versions", "plan_alerts"] as const;
export type CategorieNotification = (typeof CATEGORIES)[number] | "other";

export interface NotificationRow {
  id: string;
  user_id: string;
  /** Texte libre : la base peut évoluer avant le client. */
  type: string;
  title: string;
  message: string;
  project_id: string | null;
  related_id: string | null;
  actor_id: string | null;
  is_read: boolean;
  created_at: string;
  archived_at?: string | null;
  payload?: Record<string, unknown> | null;
}

export type Traduire = (cle: string, valeurs?: Record<string, unknown>) => string;

export function estTypeConnu(type: string): type is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(type);
}

export function categorieNotification(type: string): CategorieNotification {
  switch (type) {
    case "comment":
    case "reply":
      return "comments";
    case "task_assigned":
    case "task_mentioned":
    case "milestone_assigned":
    case "tasks_generated":
      return "tasks";
    case "invitation":
    case "collaboration_accepted":
    case "role_change":
      return "team";
    case "version":
      return "versions";
    case "plan_alert":
    case "subsidy":
      return "plan_alerts";
    default:
      return "other";
  }
}

/** Étapes du parcours visées par les notifications (routes de src/App.tsx). */
const ETAPE_ALERTE: Record<string, string> = {
  echeance_subvention: "financement",
  programme_modifie: "financement",
  capacite_garage: "plan",
  remplacement_retard: "suivi",
  donnees_energie: "suivi",
};

function texte(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

/**
 * Écran à ouvrir au clic. Jamais une route retirée : uniquement les
 * étapes du parcours (/dashboard/projects/:id/<étape>), l'Organisation, la
 * Bibliothèque. null = rien à ouvrir (la notification est seulement lue).
 */
export function lienNotification(n: Pick<NotificationRow, "type" | "project_id" | "payload">): string | null {
  const projet = n.project_id ? `/dashboard/projects/${n.project_id}` : null;
  switch (n.type) {
    case "task_assigned":
    case "task_mentioned":
    case "milestone_assigned":
    case "tasks_generated":
      return projet ? `${projet}/suivi` : null;
    case "comment":
    case "reply":
      return projet ? `${projet}/flotte?partage=comments` : null;
    case "version":
      return projet ? `${projet}/flotte?partage=versions` : null;
    case "invitation":
      return projet ? `${projet}/flotte?partage=collaborators` : "/dashboard/organization";
    case "collaboration_accepted":
      return projet ? `${projet}/flotte` : "/dashboard/organization";
    case "role_change":
      return "/dashboard/organization";
    case "subsidy":
      return projet ? `${projet}/financement` : "/dashboard/library";
    case "plan_alert": {
      if (!projet) return null;
      const kind = texte(n.payload?.kind);
      return `${projet}/${(kind && ETAPE_ALERTE[kind]) || "suivi"}`;
    }
    default:
      return projet ? `${projet}/flotte` : null;
  }
}

/**
 * Titre et message dans la langue de l'interface. Les paramètres viennent
 * de payload (rempli en base à la création) ; un paramètre absent prend
 * une formulation neutre traduite.
 */
export function texteNotification(
  n: NotificationRow,
  t: Traduire,
  langue: string,
  moi?: string | null,
): { titre: string; message: string } {
  const p = n.payload ?? {};
  const en = langue.startsWith("en");

  if (n.type === "plan_alert") {
    const titre = texte(en ? p.title_en : p.title_fr) ?? texte(p.title_fr) ?? n.title;
    const message = texte(en ? p.message_en : p.message_fr) ?? texte(p.message_fr) ?? n.message;
    return { titre, message };
  }
  if (!estTypeConnu(n.type) || !("v" in p)) {
    // Type inconnu de ce client ou ancienne notification : textes enregistrés.
    return { titre: n.title || t("notifications.fallback.title"), message: n.message || "" };
  }

  const role = texte(p.role);
  const valeurs = {
    actor: texte(p.actor) ?? t("notifications.fallback.actor"),
    project: texte(p.project) ?? t("notifications.fallback.project"),
    subject: texte(p.subject) ?? t("notifications.fallback.subject"),
    role: role ? t(`notifications.roles.${role}`, { defaultValue: role }) : t("notifications.fallback.role"),
    count: typeof p.count === "number" ? p.count : 0,
  };
  const soiMeme = n.type === "tasks_generated" && moi != null && n.actor_id === moi;
  return {
    titre: t(`notifications.kinds.${n.type}.title`, valeurs),
    message: t(`notifications.kinds.${n.type}.${soiMeme ? "messageSelf" : "message"}`, valeurs),
  };
}

/** Gravité d'une alerte du plan (pour la couleur), sinon null. */
export function graviteNotification(n: Pick<NotificationRow, "type" | "payload">): "critique" | "attention" | "info" | null {
  if (n.type !== "plan_alert") return null;
  const g = texte(n.payload?.severity);
  return g === "critique" || g === "attention" || g === "info" ? g : null;
}

/** Préférences in-app : catégorie → activée (défaut : tout activé). */
export type PreferencesNotifications = Record<(typeof CATEGORIES)[number], boolean>;

export function lirePreferences(brut: unknown): PreferencesNotifications {
  const o = brut && typeof brut === "object" ? (brut as Record<string, unknown>) : {};
  return Object.fromEntries(CATEGORIES.map((c) => [c, o[c] !== false])) as PreferencesNotifications;
}

/** Non lues parmi les notifications actives (non archivées). */
export function compterNonLues(liste: Pick<NotificationRow, "is_read" | "archived_at">[]): number {
  return liste.filter((n) => !n.is_read && !n.archived_at).length;
}
