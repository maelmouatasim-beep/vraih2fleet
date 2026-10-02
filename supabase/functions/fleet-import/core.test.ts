// Import intelligent (Phase 5.3) — correspondance proposée par un FAUX
// client Claude : sortie structurée, filtrage de tout ce qui ne se
// rattache pas aux données envoyées, refus, JSON invalide. Aucun réseau.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { proposerCorrespondance, zCorpsImport, type DepsImport } from "./core.ts";
import { SCHEMA_CORRESPONDANCE } from "../_shared/importSchema.ts";

const ORG = "11111111-1111-4111-8111-111111111111";

const corps = () =>
  zCorpsImport.parse({
    organizationId: ORG,
    colonnes: [
      { entete: "Asset #", exemples: ["T-12", "T-13"], valeursDistinctes: null, nbValeurs: 40 },
      { entete: "Énergie", exemples: ["Gas", "Diesel"], valeursDistinctes: ["Gas", "Diesel", "Bio-truc"], nbValeurs: 40 },
      { entete: "Odo (mi)", exemples: ["12 000"], valeursDistinctes: null, nbValeurs: 40 },
    ],
  });

function deps(texte: string, stop = "end_turn"): DepsImport & { params: Record<string, unknown>[]; usages: number } {
  const d = {
    params: [] as Record<string, unknown>[],
    usages: 0,
    modele: "claude-opus-5-5",
    appelerClaude: (p: Record<string, unknown>) => {
      d.params.push(structuredClone(p));
      return Promise.resolve({ content: [{ type: "text", text: texte }], stop_reason: stop, model: "claude-opus-5-5", usage: { input_tokens: 900, output_tokens: 120 } });
    },
    journaliserUsage: () => {
      d.usages++;
      return Promise.resolve();
    },
  };
  return d;
}

Deno.test("correspondance : sortie structurée imposée, entêtes et libellés vérifiés", async () => {
  const d = deps(
    JSON.stringify({
      colonnes: [
        { entete: "Asset #", champ: "unit_number", certitude: "sure", unite: "" },
        { entete: "Énergie", champ: "fuel_type", certitude: "sure", unite: "" },
        { entete: "Odo (mi)", champ: "annual_km", certitude: "probable", unite: "mi" },
        { entete: "Colonne inventée", champ: "vin", certitude: "sure", unite: "" },
        { entete: "Asset #", champ: "notes", certitude: "sure", unite: "" },
      ],
      valeurs: [
        { champ: "fuel_type", source: "Gas", cible: "essence", certitude: "sure" },
        { champ: "fuel_type", source: "Bio-truc", cible: "biodiesel_maison", certitude: "probable" },
        { champ: "fuel_type", source: "Kérosène", cible: "autre", certitude: "sure" },
      ],
    }),
  );
  const r = await proposerCorrespondance(corps(), d);
  assert(r.type === "correspondance");
  // entête inventée et doublon d'entête rejetés
  assertEquals(r.correspondance.colonnes.map((c) => c.entete), ["Asset #", "Énergie", "Odo (mi)"]);
  assertEquals(r.correspondance.colonnes[0].champ, "unit_number");
  // cible hors liste ⇒ vide + incertaine ; libellé absent des données ⇒ rejeté
  assertEquals(r.correspondance.valeurs, [
    { champ: "fuel_type", source: "Gas", cible: "essence", certitude: "sure" },
    { champ: "fuel_type", source: "Bio-truc", cible: "", certitude: "incertaine" },
  ]);
  assertEquals(r.rejets, 4);
  // appel : schéma JSON imposé, effort bas, données en message utilisateur, usage journalisé
  const p = d.params[0] as {
    output_config: { format: unknown; effort: string };
    tool_choice?: unknown;
    system: string;
    messages: { content: string }[];
  };
  assertEquals(p.output_config.format, { type: "json_schema", schema: SCHEMA_CORRESPONDANCE });
  assertEquals(p.output_config.effort, "low");
  assertEquals(p.tool_choice, undefined);
  assert(String(p.system).includes("N'invente jamais"));
  assertEquals(JSON.parse(p.messages[0].content).colonnes.length, 3);
  assertEquals(d.usages, 1);
});

Deno.test("refus et JSON invalide : aucune correspondance", async () => {
  assertEquals((await proposerCorrespondance(corps(), deps("", "refusal"))).type, "refus");
  assertEquals((await proposerCorrespondance(corps(), deps("pas du json"))).type, "invalide");
  assertEquals((await proposerCorrespondance(corps(), deps(JSON.stringify({ colonnes: [{ entete: "x", champ: "prix", certitude: "sure", unite: "" }], valeurs: [] })))).type, "invalide");
});

Deno.test("corps : bornes de taille (minimisation)", () => {
  assert(!zCorpsImport.safeParse({ organizationId: ORG, colonnes: [] }).success);
  assert(!zCorpsImport.safeParse({ organizationId: ORG, colonnes: [{ entete: "a", exemples: ["1", "2", "3", "4"], valeursDistinctes: null, nbValeurs: 1 }] }).success);
  assert(!zCorpsImport.safeParse({ organizationId: ORG, colonnes: [{ entete: "a".repeat(81), exemples: [], valeursDistinctes: null, nbValeurs: 1 }] }).success);
});
