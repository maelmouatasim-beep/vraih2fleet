/**
 * Icône et couleur de chaque type de notification. TOUT type a un rendu :
 * un type inconnu (base plus récente que le client) prend la cloche par
 * défaut — plus jamais d'icône indéfinie au rendu.
 */
import {
  Activity,
  AlertTriangle,
  AtSign,
  Bell,
  Flag,
  HandCoins,
  History,
  ListChecks,
  ListTodo,
  MessageCircle,
  Reply,
  Shield,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { graviteNotification, type NotificationRow, type NotificationType } from "@/lib/notifications/model";

export interface Apparence {
  icone: LucideIcon;
  classes: string;
}

export const APPARENCE_PAR_DEFAUT: Apparence = { icone: Bell, classes: "text-muted-foreground bg-muted" };

const APPARENCES: Record<NotificationType, Apparence> = {
  comment: { icone: MessageCircle, classes: "text-blue-600 bg-blue-500/10" },
  reply: { icone: Reply, classes: "text-purple-600 bg-purple-500/10" },
  invitation: { icone: UserPlus, classes: "text-green-600 bg-green-500/10" },
  collaboration_accepted: { icone: UserCheck, classes: "text-green-600 bg-green-500/10" },
  role_change: { icone: Shield, classes: "text-yellow-600 bg-yellow-500/10" },
  version: { icone: History, classes: "text-orange-600 bg-orange-500/10" },
  task_assigned: { icone: ListTodo, classes: "text-emerald-600 bg-emerald-500/10" },
  task_mentioned: { icone: AtSign, classes: "text-orange-600 bg-orange-500/10" },
  milestone_assigned: { icone: Flag, classes: "text-cyan-600 bg-cyan-500/10" },
  tasks_generated: { icone: ListChecks, classes: "text-emerald-600 bg-emerald-500/10" },
  subsidy: { icone: HandCoins, classes: "text-amber-600 bg-amber-500/10" },
  plan_alert: { icone: Activity, classes: "text-amber-600 bg-amber-500/10" },
};

export function apparenceNotification(n: Pick<NotificationRow, "type" | "payload">): Apparence {
  if (n.type === "plan_alert" && graviteNotification(n) === "critique") {
    return { icone: AlertTriangle, classes: "text-red-600 bg-red-500/10" };
  }
  return (APPARENCES as Record<string, Apparence | undefined>)[n.type] ?? APPARENCE_PAR_DEFAUT;
}
