/**
 * Proactive Triggers for the AI Assistant
 * These triggers allow the assistant to offer help based on user behavior
 */

export interface TriggerContext {
  page_type: string;
  current_url: string;
  user_id?: string;
  is_new_user?: boolean;
  time_on_page?: number; // seconds
  form_completion_pct?: number;
  empty_required_fields?: string[];
  form_data?: {
    reference_data_usage_pct?: number;
    vehicle_types?: string[];
    total_vehicles?: number;
  };
  has_projects?: boolean;
  has_scenarios?: boolean;
}

export interface Trigger {
  id: string;
  condition: (context: TriggerContext) => boolean;
  message: string;
  priority: number;
  // If true, only show once per session
  showOnce?: boolean;
}

export const PROACTIVE_TRIGGERS: Trigger[] = [
  {
    id: 'welcome_new_user',
    condition: (ctx) => ctx.is_new_user === true && ctx.page_type === 'dashboard',
    message: "👋 Première visite ? Je peux vous faire un tour guidé de 3 minutes pour créer votre premier scénario TCO. Tapez **\"guide\"** pour commencer !",
    priority: 10,
    showOnce: true,
  },
  {
    id: 'no_projects_yet',
    condition: (ctx) => 
      ctx.page_type === 'dashboard' && 
      ctx.has_projects === false,
    message: "💡 Vous n'avez pas encore de projet. Un projet regroupe vos scénarios TCO. Cliquez sur **\"Nouveau Projet\"** en haut à droite pour commencer !",
    priority: 9,
    showOnce: true,
  },
  {
    id: 'stuck_on_form',
    condition: (ctx) => 
      ctx.page_type === 'scenario_form' && 
      (ctx.time_on_page ?? 0) > 120 && 
      (ctx.form_completion_pct ?? 0) < 10,
    message: "💬 Besoin d'aide pour démarrer ? Je peux vous expliquer quelles données vous devez rassembler avant de remplir ce formulaire. Dites-moi !",
    priority: 8,
  },
  {
    id: 'scenario_form_intro',
    condition: (ctx) => 
      ctx.page_type === 'scenario_form' && 
      (ctx.time_on_page ?? 0) < 15,
    message: "📝 **Conseil :** Ayez sous la main vos devis fournisseurs (véhicules, énergie) pour des résultats précis. Besoin d'aide sur un champ spécifique ?",
    priority: 5,
    showOnce: true,
  },
  {
    id: 'h2_price_help',
    condition: (ctx) => 
      ctx.page_type === 'scenario_form' &&
      (ctx.empty_required_fields?.includes('h2_price') ?? false) &&
      (ctx.time_on_page ?? 0) > 60,
    message: "💡 **Prix hydrogène :** Utilisez un devis fournisseur (Air Liquide, HTEC) si possible. Sinon, la moyenne QC 2026 est 12-15$/kg. Demandez-moi les références !",
    priority: 7,
  },
  {
    id: 'ev_price_help',
    condition: (ctx) => 
      ctx.page_type === 'scenario_form' &&
      (ctx.empty_required_fields?.includes('electricity_price') ?? false) &&
      (ctx.time_on_page ?? 0) > 60,
    message: "⚡ **Prix électricité :** Au Québec, le Tarif M est ~0.05-0.08$/kWh. N'oubliez pas les frais de puissance pour la recharge rapide !",
    priority: 7,
  },
  {
    id: 'results_ready',
    condition: (ctx) => 
      ctx.page_type === 'scenario_results' &&
      (ctx.time_on_page ?? 0) < 10,
    message: "✅ Résultats prêts ! Voulez-vous que j'explique le **payback**, le **TCO/km**, ou les **leviers d'optimisation** ?",
    priority: 6,
    showOnce: true,
  },
  {
    id: 'high_reference_data_usage',
    condition: (ctx) => 
      (ctx.form_data?.reference_data_usage_pct ?? 0) > 70 &&
      ctx.form_completion_pct === 100,
    message: "⚠️ Votre scénario utilise principalement des moyennes industrielles (>70%). Pour un business case solide, obtenez des **devis réels** pour les coûts clés (véhicules, énergie).",
    priority: 9,
  },
  {
    id: 'infrastructure_reminder',
    condition: (ctx) => 
      ctx.page_type === 'scenario_results' &&
      (ctx.time_on_page ?? 0) > 30,
    message: "🔌 N'oubliez pas d'estimer les coûts d'infrastructure ! Allez dans la section **Infrastructure** pour calculer et appliquer ces coûts à votre scénario.",
    priority: 5,
    showOnce: true,
  },
  {
    id: 'subsidies_reminder',
    condition: (ctx) => 
      ctx.page_type === 'scenario_results' &&
      (ctx.form_data?.vehicle_types?.some(v => v.includes('ev') || v.includes('h2')) ?? false),
    message: "💰 **Subventions disponibles !** iMHZEV offre jusqu'à 200k$ pour les FCEV Classe 8. Consultez la page **Subventions** pour tous les programmes.",
    priority: 6,
    showOnce: true,
  },
  {
    id: 'analytics_suggestion',
    condition: (ctx) => 
      ctx.page_type === 'scenarios_list' &&
      ctx.has_scenarios === true,
    message: "📊 Vous avez des scénarios ! Visitez **Analytics** pour des graphiques comparatifs avancés et des analyses de sensibilité.",
    priority: 4,
    showOnce: true,
  },
];

/**
 * Evaluate all proactive triggers and return the highest priority matching trigger
 */
export function evaluateProactiveTriggers(
  context: TriggerContext,
  shownTriggerIds: Set<string>
): Trigger | null {
  const matchingTriggers = PROACTIVE_TRIGGERS
    .filter(trigger => {
      // Skip if already shown and showOnce is true
      if (trigger.showOnce && shownTriggerIds.has(trigger.id)) {
        return false;
      }
      // Evaluate condition
      try {
        return trigger.condition(context);
      } catch (e) {
        console.error('Error evaluating trigger', trigger.id, e);
        return false;
      }
    })
    .sort((a, b) => b.priority - a.priority);

  return matchingTriggers[0] || null;
}

/**
 * Storage key for tracking shown triggers per user
 */
export const getShownTriggersKey = (userId?: string) => 
  `assistant_shown_triggers_${userId || 'anonymous'}`;
