/**
 * Déclencheurs proactifs de l'assistant (D3) — pages ACTUELLES, messages
 * en clés i18n (assistant.triggers.<id>), AUCUN chiffre figé : les prix,
 * montants et statuts de programmes vivent dans le registre et les écrans.
 */
import type { TypePage } from "@/lib/assistant/context";

export interface TriggerContext {
  page_type: TypePage | string;
  current_url: string;
  user_id?: string;
  is_new_user?: boolean;
  time_on_page?: number; // secondes
  has_projects?: boolean;
  has_fleet?: boolean;
}

export interface Trigger {
  id: string;
  condition: (context: TriggerContext) => boolean;
  /** clé i18n du message */
  messageKey: string;
  priority: number;
  showOnce?: boolean;
}

export const PROACTIVE_TRIGGERS: Trigger[] = [
  {
    id: "welcome_new_user",
    condition: (ctx) => ctx.is_new_user === true && ctx.page_type === "dashboard",
    messageKey: "assistant.triggers.welcomeNewUser",
    priority: 10,
    showOnce: true,
  },
  {
    id: "no_fleet_yet",
    condition: (ctx) => ctx.page_type === "dashboard" && ctx.has_fleet === false,
    messageKey: "assistant.triggers.noFleetYet",
    priority: 9,
    showOnce: true,
  },
  {
    id: "no_projects_yet",
    condition: (ctx) =>
      ctx.page_type === "dashboard" && ctx.has_fleet === true && ctx.has_projects === false,
    messageKey: "assistant.triggers.noProjectsYet",
    priority: 8,
    showOnce: true,
  },
  {
    id: "feasibility_intro",
    condition: (ctx) => ctx.page_type === "journey_faisabilite" && (ctx.time_on_page ?? 0) < 15,
    messageKey: "assistant.triggers.feasibilityIntro",
    priority: 5,
    showOnce: true,
  },
  {
    id: "strategies_apply",
    condition: (ctx) => ctx.page_type === "journey_strategies" && (ctx.time_on_page ?? 0) > 30,
    messageKey: "assistant.triggers.strategiesApply",
    priority: 5,
    showOnce: true,
  },
  {
    id: "financing_confirmed",
    condition: (ctx) => ctx.page_type === "journey_financement" && (ctx.time_on_page ?? 0) > 20,
    messageKey: "assistant.triggers.financingConfirmed",
    priority: 5,
    showOnce: true,
  },
];

/** Déclencheur de plus haute priorité applicable (non déjà montré si showOnce). */
export function evaluateProactiveTriggers(
  context: TriggerContext,
  shownTriggerIds: Set<string>,
): Trigger | null {
  const candidats = PROACTIVE_TRIGGERS.filter((trigger) => {
    if (trigger.showOnce && shownTriggerIds.has(trigger.id)) return false;
    try {
      return trigger.condition(context);
    } catch {
      return false;
    }
  }).sort((a, b) => b.priority - a.priority);
  return candidats[0] ?? null;
}

export const getShownTriggersKey = (userId?: string) =>
  `assistant_shown_triggers_${userId || "anonymous"}`;
