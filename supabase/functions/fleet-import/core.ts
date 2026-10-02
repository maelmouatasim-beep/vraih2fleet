// Import intelligent (Phase 5.3) — correspondance proposée par Claude,
// VÉRIFIÉE champ par champ : entêtes et libellés recopiés à l'identique
// de la requête, valeurs cibles dans les listes autorisées. L'IA ne
// produit aucune donnée de véhicule (ni nombre, ni valeur transcrite).
import { z } from "../_shared/validation.ts";
import {
  CERTITUDES,
  CHAMPS,
  CHAMPS_A_CHOIX,
  promptImport,
  SCHEMA_CORRESPONDANCE,
  UNITES,
  VALEURS,
} from "../_shared/importSchema.ts";

export const zCorpsImport = z.object({
  organizationId: z.string().uuid(),
  langue: z.enum(["fr", "en"]).default("fr"),
  colonnes: z
    .array(
      z.object({
        entete: z.string().min(1).max(80),
        exemples: z.array(z.string().max(40)).max(3),
        valeursDistinctes: z.array(z.string().max(40)).max(30).nullable(),
        nbValeurs: z.number().int().min(0).max(100_000),
      }),
    )
    .min(1)
    .max(80),
});
export type CorpsImport = z.infer<typeof zCorpsImport>;

const zReponse = z.object({
  colonnes: z.array(
    z.object({
      entete: z.string(),
      champ: z.enum([...CHAMPS, "ignorer"]),
      certitude: z.enum(CERTITUDES),
      unite: z.union([z.literal(""), z.enum(UNITES)]),
    }),
  ),
  valeurs: z.array(
    z.object({
      champ: z.enum(CHAMPS_A_CHOIX),
      source: z.string(),
      cible: z.string(),
      certitude: z.enum(CERTITUDES),
    }),
  ),
});
export type CorrespondanceIa = z.infer<typeof zReponse>;

export interface DepsImport {
  appelerClaude: (params: Record<string, unknown>) => Promise<{
    content: Record<string, unknown>[];
    stop_reason: string | null;
    model: string;
    usage: Record<string, number | null | undefined>;
  }>;
  modele: string;
  journaliserUsage: (modele: string, usage: Record<string, number | null | undefined>) => Promise<void>;
}

export type SortieImport = { type: "correspondance"; correspondance: CorrespondanceIa; rejets: number } | { type: "refus" } | { type: "invalide" };

/** Garde seulement ce qui se rattache aux DONNÉES envoyées. */
export function filtrerCorrespondance(r: CorrespondanceIa, corps: CorpsImport): { correspondance: CorrespondanceIa; rejets: number } {
  const entetes = new Set(corps.colonnes.map((c) => c.entete));
  const libelles = new Set(corps.colonnes.flatMap((c) => [...(c.valeursDistinctes ?? []), ...c.exemples]));
  let rejets = 0;
  const vues = new Set<string>();
  const colonnes = r.colonnes.filter((c) => {
    const ok = entetes.has(c.entete) && !vues.has(c.entete);
    vues.add(c.entete);
    if (!ok) rejets++;
    return ok;
  });
  const valeurs = r.valeurs.flatMap((v) => {
    if (!libelles.has(v.source)) {
      rejets++;
      return [];
    }
    if (v.cible !== "" && !VALEURS[v.champ].includes(v.cible)) {
      rejets++;
      return [{ ...v, cible: "", certitude: "incertaine" as const }];
    }
    return [v];
  });
  return { correspondance: { colonnes, valeurs }, rejets };
}

export async function proposerCorrespondance(corps: CorpsImport, deps: DepsImport): Promise<SortieImport> {
  const reponse = await deps.appelerClaude({
    model: deps.modele,
    max_tokens: 8000,
    system: promptImport(corps.langue),
    messages: [{ role: "user", content: JSON.stringify({ colonnes: corps.colonnes }) }],
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA_CORRESPONDANCE } },
    fallbacks: "default",
    betas: ["server-side-fallback-2026-07-01"],
  });
  await deps.journaliserUsage(reponse.model, reponse.usage);
  if (reponse.stop_reason === "refusal") return { type: "refus" };
  const texte = reponse.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(texte);
  } catch {
    return { type: "invalide" };
  }
  const r = zReponse.safeParse(json);
  if (!r.success) return { type: "invalide" };
  const { correspondance, rejets } = filtrerCorrespondance(r.data, corps);
  return { type: "correspondance", correspondance, rejets };
}
