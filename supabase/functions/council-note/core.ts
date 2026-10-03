// Note au conseil (Phase 5.7) — rédaction par Claude SANS CHIFFRE : la
// prose ne contient que des jetons {{fait}} ; tout brouillon contenant un
// chiffre hors jeton ou un jeton inconnu est rejeté, puis redemandé UNE
// fois avec la liste des écarts. Rien n'est stocké par la fonction.
import { z } from "../_shared/validation.ts";
import {
  promptNote,
  SCHEMA_NOTE,
  SECTIONS_NOTE,
  verifierBrouillon,
  type EcartNote,
  type SectionsNote,
} from "../_shared/councilNote.ts";

export const zCorpsNote = z.object({
  projectId: z.string().uuid(),
  langue: z.enum(["fr", "en"]).default("fr"),
  faits: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9_]{1,40}$/),
        libelle: z.string().min(1).max(200),
        valeur: z.string().min(1).max(400),
      }),
    )
    .min(1)
    .max(80),
});
export type CorpsNote = z.infer<typeof zCorpsNote>;

const zSections = z.object(Object.fromEntries(SECTIONS_NOTE.map((s) => [s, z.string()])) as Record<(typeof SECTIONS_NOTE)[number], z.ZodString>);

export interface DepsNote {
  appelerClaude: (params: Record<string, unknown>) => Promise<{
    content: Record<string, unknown>[];
    stop_reason: string | null;
    model: string;
    usage: Record<string, number | null | undefined>;
  }>;
  modele: string;
  journaliserUsage: (modele: string, usage: Record<string, number | null | undefined>) => Promise<void>;
}

export type SortieNote =
  | { type: "note"; sections: SectionsNote; tentatives: number; ecartsRejetes: number }
  | { type: "refus" }
  | { type: "invalide"; ecarts: EcartNote[] };

function texteDe(content: Record<string, unknown>[]): string {
  return content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
}

export async function redigerNote(corps: CorpsNote, deps: DepsNote): Promise<SortieNote> {
  const ids = new Set(corps.faits.map((f) => f.id));
  const faits = `<faits>\n${JSON.stringify(corps.faits, null, 1)}\n</faits>`;
  const messages: Record<string, unknown>[] = [
    {
      role: "user",
      content: `${faits}\n\n${corps.langue === "fr" ? "Rédige la note au conseil selon les règles." : "Write the note to council following the rules."}`,
    },
  ];
  let ecartsRejetes = 0;
  let derniers: EcartNote[] = [];
  for (let tentative = 1; tentative <= 2; tentative++) {
    const reponse = await deps.appelerClaude({
      model: deps.modele,
      max_tokens: 6000,
      system: promptNote(corps.langue),
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA_NOTE } },
      fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01"],
    });
    await deps.journaliserUsage(reponse.model, reponse.usage);
    if (reponse.stop_reason === "refusal") return { type: "refus" };
    const brut = texteDe(reponse.content);
    let sections: SectionsNote | null = null;
    try {
      const r = zSections.safeParse(JSON.parse(brut));
      if (r.success) sections = r.data as SectionsNote;
    } catch {
      sections = null;
    }
    derniers = sections
      ? verifierBrouillon(sections, ids)
      : [{ section: "recommandation", type: "vide", extrait: "réponse illisible" }];
    if (sections && derniers.length === 0) return { type: "note", sections, tentatives: tentative, ecartsRejetes };
    ecartsRejetes += derniers.length;
    messages.push({ role: "assistant", content: brut || "{}" });
    messages.push({
      role: "user",
      content:
        `[Vérification] ${corps.langue === "fr" ? "Brouillon rejeté. Écarts" : "Draft rejected. Issues"} : ` +
        derniers.map((e) => `${e.section} — ${e.type} « ${e.extrait} »`).join(" ; ") +
        (corps.langue === "fr"
          ? ". Réécris TOUTE la note : chaque valeur chiffrée doit être un jeton {{identifiant}} de la liste, sans aucun chiffre en clair."
          : ". Rewrite the WHOLE note: every numeric value must be a {{identifier}} token from the list, with no figure in clear."),
    });
  }
  return { type: "invalide", ecarts: derniers };
}
