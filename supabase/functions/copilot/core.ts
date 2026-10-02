// Copilote de projet (Phase 5.2) — logique du tour, indépendante du
// transport (testée avec un faux client Claude, sans réseau).
//
// Boucle d'outils en aller-retour avec le navigateur : la fonction appelle
// Claude ; si Claude demande des outils, la fonction renvoie le tour au
// navigateur, qui les exécute avec le moteur TCO et renvoie les résultats.
// Le tour est APPEND-ONLY (contenu de l'assistant renvoyé tel quel,
// condition du « preserved thinking »). Réponse finale : chaque nombre est
// vérifié contre les résultats d'outils, les données du projet et les
// messages de l'utilisateur ; sinon correction automatique (2 essais) puis
// refus d'afficher une réponse non vérifiée.
import { z } from "../_shared/validation.ts";
import { messageCorrection, OUTILS_COPILOTE, promptSysteme } from "../_shared/copilotTools.ts";
import { verifierNombres } from "../_shared/numberCheck.ts";

export const MAX_TENTATIVES_VERIFICATION = 2;
const PREFIXES_CORRECTION = ["[Vérification automatique]", "[Automatic check]"];

const zBlocUtilisateur = z.union([
  z.object({
    type: z.literal("tool_result"),
    tool_use_id: z.string().min(1).max(200),
    content: z.string().max(200_000),
    is_error: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("text"),
    text: z.string().max(4000).refine((t) => PREFIXES_CORRECTION.some((p) => t.startsWith(p)), {
      message: "seuls les messages de vérification automatique sont acceptés",
    }),
  }),
]);

export const zCorpsCopilote = z.object({
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  langue: z.enum(["fr", "en"]).default("fr"),
  question: z.string().min(1).max(2000),
  contexte: z.record(z.unknown()),
  precedents: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }))
    .max(16)
    .default([]),
  tour: z
    .array(
      z.union([
        z.object({ role: z.literal("assistant"), content: z.array(z.record(z.unknown())).max(80) }),
        z.object({ role: z.literal("user"), content: z.array(zBlocUtilisateur).min(1).max(40) }),
      ]),
    )
    .max(40)
    .default([]),
  tentatives: z.number().int().min(0).max(5).default(0),
});
export type CorpsCopilote = z.infer<typeof zCorpsCopilote>;

type Bloc = Record<string, unknown>;
type MessageTour = { role: "user" | "assistant"; content: Bloc[] };

export interface ReponseClaude {
  content: Bloc[];
  stop_reason: string | null;
  model: string;
  usage: Record<string, number | null | undefined>;
}

export interface DepsCopilote {
  appelerClaude: (params: Record<string, unknown>) => Promise<ReponseClaude>;
  modele: string;
  /** Contrôle quotas/flags avant CHAQUE appel (lève HttpError). */
  controler: () => Promise<void>;
  journaliserUsage: (modele: string, usage: Record<string, number | null | undefined>) => Promise<void>;
  enregistrer: (e: {
    question: string;
    reponse: string;
    sources: string[];
    nombresVerifies: number;
    proposition: unknown;
  }) => Promise<string | null>;
}

export type SortieCopilote =
  | { type: "outils"; tour: MessageTour[]; appels: { id: string; name: string; input: unknown }[]; tentatives: number }
  | {
      type: "reponse";
      texte: string;
      nombresVerifies: number;
      sources: string[];
      proposition: unknown;
      messageId: string | null;
    }
  | { type: "non_verifie"; nonVerifies: string[] }
  | { type: "refus" };

/** Valeurs des clés « source » et dernière « proposition » des résultats d'outils. */
export function extraireSourcesEtProposition(tour: MessageTour[]): { sources: string[]; proposition: unknown } {
  const sources = new Set<string>();
  let proposition: unknown = null;
  const parcourir = (x: unknown) => {
    if (Array.isArray(x)) x.forEach(parcourir);
    else if (x && typeof x === "object") {
      for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
        if (k === "source" && typeof v === "string") sources.add(v);
        else if (k === "proposition" && v && typeof v === "object") proposition = v;
        else parcourir(v);
      }
    }
  };
  for (const m of tour) {
    if (m.role !== "user") continue;
    for (const b of m.content) {
      if (b.type !== "tool_result" || typeof b.content !== "string") continue;
      try {
        parcourir(JSON.parse(b.content));
      } catch {
        // résultat non JSON : pas de source structurée
      }
    }
  }
  return { sources: [...sources].slice(0, 30), proposition };
}

function resultatsOutils(tour: MessageTour[]): string[] {
  const out: string[] = [];
  for (const m of tour) {
    if (m.role !== "user") continue;
    for (const b of m.content) if (b.type === "tool_result" && typeof b.content === "string") out.push(b.content);
  }
  return out;
}

export async function traiterTour(corps: CorpsCopilote, deps: DepsCopilote): Promise<SortieCopilote> {
  const contexteJson = JSON.stringify(corps.contexte);
  if (contexteJson.length > 40_000) throw new Error("contexte trop volumineux");
  const systeme = promptSysteme(corps.langue, contexteJson);
  const tour: MessageTour[] = corps.tour.map((m) => ({ role: m.role, content: m.content as Bloc[] }));
  let tentatives = corps.tentatives;

  // Bornée : au plus MAX_TENTATIVES_VERIFICATION corrections dans un même appel.
  for (let i = 0; i <= MAX_TENTATIVES_VERIFICATION; i++) {
    await deps.controler();
    const messages = [
      ...corps.precedents.map((p) => ({ role: p.role, content: p.content })),
      { role: "user", content: corps.question },
      ...tour,
    ];
    const reponse = await deps.appelerClaude({
      model: deps.modele,
      max_tokens: 8000,
      system: systeme,
      tools: OUTILS_COPILOTE,
      messages,
      thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01", "thinking-binding-controls-2026-08-01"],
    });
    await deps.journaliserUsage(reponse.model, reponse.usage);

    if (reponse.stop_reason === "refusal") return { type: "refus" };

    const appels = reponse.content
      .filter((b) => b.type === "tool_use")
      .map((b) => ({ id: String(b.id), name: String(b.name), input: b.input }));
    if (reponse.stop_reason === "tool_use" && appels.length > 0) {
      tour.push({ role: "assistant", content: reponse.content });
      return { type: "outils", tour, appels, tentatives };
    }

    const texte = reponse.content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n")
      .trim();
    const verification = verifierNombres(
      texte,
      corps.langue,
      corps.contexte,
      corps.question,
      corps.precedents.map((p) => p.content),
      resultatsOutils(tour),
    );
    if (texte && verification.ok) {
      const { sources, proposition } = extraireSourcesEtProposition(tour);
      const messageId = await deps.enregistrer({
        question: corps.question,
        reponse: texte,
        sources,
        nombresVerifies: verification.verifies,
        proposition,
      });
      return { type: "reponse", texte, nombresVerifies: verification.verifies, sources, proposition, messageId };
    }

    if (tentatives >= MAX_TENTATIVES_VERIFICATION) {
      return { type: "non_verifie", nonVerifies: verification.nonVerifies };
    }
    tentatives += 1;
    // Append-only : la réponse rejetée reste, la consigne de correction suit.
    tour.push({ role: "assistant", content: reponse.content });
    tour.push({
      role: "user",
      content: [
        {
          type: "text",
          text: messageCorrection(
            corps.langue,
            texte ? verification.nonVerifies : [corps.langue === "en" ? "(empty answer)" : "(réponse vide)"],
          ),
        },
      ],
    });
  }
  return { type: "non_verifie", nonVerifies: [] };
}
