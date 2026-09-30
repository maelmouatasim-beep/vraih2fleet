/**
 * D3 — Contexte de l'assistant : type de page (pages ACTUELLES du menu
 * 6 entrées et du parcours 7 étapes) et actions rapides associées.
 * PUR (testé). Les libellés et questions sont des clés i18n
 * (assistant.quick.<cle>.label / .query) ; aucune question n'appelle un
 * chiffre figé : l'assistant renvoie aux écrans qui affichent la source.
 */
export const ETAPES_PARCOURS = [
  "flotte",
  "faisabilite",
  "strategies",
  "plan",
  "financement",
  "rapports",
  "suivi",
] as const;

export type TypePage =
  | "home"
  | "dashboard"
  | "fleet"
  | "projects"
  | `journey_${(typeof ETAPES_PARCOURS)[number]}`
  | "library"
  | "telematics"
  | "organization"
  | "help"
  | "unknown";

export function typePage(pathname: string): TypePage {
  const chemin = pathname.replace(/\/+$/, "") || "/";
  if (chemin === "/") return "home";
  if (chemin === "/dashboard") return "dashboard";
  const etape = chemin.match(/^\/dashboard\/projects\/[^/]+\/([a-z]+)$/);
  if (etape && (ETAPES_PARCOURS as readonly string[]).includes(etape[1])) {
    return `journey_${etape[1]}` as TypePage;
  }
  if (chemin.startsWith("/dashboard/projects")) return "projects";
  if (chemin.startsWith("/dashboard/fleet")) return "fleet";
  if (chemin.startsWith("/dashboard/library")) return "library";
  if (chemin.startsWith("/dashboard/telematics")) return "telematics";
  if (chemin.startsWith("/dashboard/organization")) return "organization";
  if (chemin.startsWith("/dashboard/help")) return "help";
  return "unknown";
}

export interface ActionRapide {
  id: string;
  icon: string;
  /** clé sous assistant.quick.* */
  cle: string;
}

const ACTIONS: Partial<Record<TypePage, ActionRapide[]>> = {
  home: [
    { id: "what", icon: "❓", cle: "whatIsH2Fleet" },
    { id: "start", icon: "🚀", cle: "getStarted" },
  ],
  dashboard: [
    { id: "start", icon: "🚀", cle: "getStarted" },
    { id: "journey", icon: "🧭", cle: "journeySteps" },
    { id: "data", icon: "📚", cle: "whereNumbers" },
  ],
  fleet: [
    { id: "import", icon: "📥", cle: "importFleet" },
    { id: "estimate", icon: "📏", cle: "estimatedConsumption" },
    { id: "telematics", icon: "🔌", cle: "telematicsToFleet" },
  ],
  projects: [
    { id: "create", icon: "➕", cle: "createProject" },
    { id: "params", icon: "⚙️", cle: "projectParams" },
  ],
  journey_flotte: [
    { id: "select", icon: "🚛", cle: "selectVehicles" },
    { id: "suggested", icon: "✨", cle: "suggestedTarget" },
  ],
  journey_faisabilite: [
    { id: "verdict", icon: "⚖️", cle: "readVerdict" },
    { id: "clientData", icon: "🧾", cle: "clientData" },
  ],
  journey_strategies: [
    { id: "stress", icon: "📊", cle: "stressTest" },
    { id: "apply", icon: "✅", cle: "applyStrategy" },
  ],
  journey_plan: [
    { id: "budget", icon: "💵", cle: "readBudget" },
    { id: "infra", icon: "🔌", cle: "depotInfra" },
  ],
  journey_financement: [
    { id: "status", icon: "📅", cle: "programStatus" },
    { id: "confirmed", icon: "🧾", cle: "confirmedSubsidy" },
    { id: "tracking", icon: "📋", cle: "applicationTracking" },
  ],
  journey_rapports: [
    { id: "snapshot", icon: "📄", cle: "reportSnapshot" },
    { id: "appendix", icon: "📚", cle: "whereNumbers" },
  ],
  journey_suivi: [
    { id: "completed", icon: "✔️", cle: "markCompleted" },
    { id: "tasks", icon: "🗂️", cle: "generatedTasks" },
  ],
  library: [
    { id: "status", icon: "🏷️", cle: "assumptionStatus" },
    { id: "clientData", icon: "🧾", cle: "clientData" },
  ],
  telematics: [
    { id: "connect", icon: "🔌", cle: "connectTelematics" },
    { id: "import", icon: "📥", cle: "telematicsToFleet" },
  ],
  organization: [
    { id: "team", icon: "👥", cle: "inviteTeam" },
    { id: "clientData", icon: "🧾", cle: "clientData" },
  ],
};

const DEFAUT: ActionRapide[] = [
  { id: "journey", icon: "🧭", cle: "journeySteps" },
  { id: "data", icon: "📚", cle: "whereNumbers" },
];

export function actionsRapides(page: TypePage): ActionRapide[] {
  return ACTIONS[page] ?? DEFAUT;
}

/** Toutes les clés d'actions rapides utilisées (pour le test de parité i18n). */
export function toutesClesActions(): string[] {
  const cles = new Set<string>();
  for (const liste of [...Object.values(ACTIONS), DEFAUT]) {
    for (const a of liste ?? []) cles.add(a.cle);
  }
  return [...cles];
}
