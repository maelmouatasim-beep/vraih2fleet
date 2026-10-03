import { assertEquals } from "jsr:@std/assert@1";
import { redigerNote, type DepsNote } from "./core.ts";
import { verifierBrouillon, SECTIONS_NOTE, type SectionsNote } from "../_shared/councilNote.ts";

const FAITS = [
  { id: "van_centrale", libelle: "Économie actualisée", valeur: "26 563 $" },
  { id: "horizon_ans", libelle: "Horizon", valeur: "10 ans" },
];
const sections = (texte: string): SectionsNote =>
  Object.fromEntries(SECTIONS_NOTE.map((s) => [s, texte])) as SectionsNote;

function deps(reponses: SectionsNote[]): DepsNote & { appels: Record<string, unknown>[] } {
  const appels: Record<string, unknown>[] = [];
  return {
    appels,
    modele: "claude-opus-5-5",
    journaliserUsage: async () => {},
    appelerClaude: async (p) => {
      appels.push(p);
      const r = reponses[Math.min(appels.length - 1, reponses.length - 1)];
      return { content: [{ type: "text", text: JSON.stringify(r) }], stop_reason: "end_turn", model: "claude-opus-5-5", usage: {} };
    },
  };
}

Deno.test("verifierBrouillon : chiffre hors jeton, jeton inconnu et section vide signalés ; sigles permis", () => {
  const ids = new Set(["van_centrale"]);
  const s = sections("Le plan économise {{van_centrale}} et réduit le CO2e ; H2 non retenu.");
  assertEquals(verifierBrouillon(s, ids), []);
  const mauvais = { ...s, couts: "Économie de 26 563 $ sur 10 ans.", risques: "{{inconnu}} risque.", hiver: " " };
  const ecarts = verifierBrouillon(mauvais, ids);
  assertEquals(ecarts.filter((e) => e.section === "couts").map((e) => e.extrait), ["26", "563", "10"]);
  assertEquals(ecarts.find((e) => e.section === "risques")?.type, "jeton_inconnu");
  assertEquals(ecarts.find((e) => e.section === "hiver")?.type, "vide");
});

Deno.test("redigerNote : brouillon avec chiffre rejeté puis redemandé ; la note retenue ne contient que des jetons", async () => {
  const d = deps([sections("Économie de 26 563 $."), sections("Le plan économise {{van_centrale}} sur {{horizon_ans}}.")]);
  const r = await redigerNote({ projectId: crypto.randomUUID(), langue: "fr", faits: FAITS }, d);
  assertEquals(r.type, "note");
  if (r.type !== "note") return;
  assertEquals(r.tentatives, 2);
  assertEquals(r.ecartsRejetes > 0, true);
  assertEquals(d.appels.length, 2);
  const second = d.appels[1].messages as { role: string; content: string }[];
  assertEquals(second.at(-1)?.content.startsWith("[Vérification]"), true);
  assertEquals(d.appels[0].tool_choice, undefined);
});

Deno.test("redigerNote : deux brouillons invalides → invalide, jamais de texte non vérifié renvoyé", async () => {
  const d = deps([sections("Économie de 26 563 $.")]);
  const r = await redigerNote({ projectId: crypto.randomUUID(), langue: "en", faits: FAITS }, d);
  assertEquals(r.type, "invalide");
  assertEquals(d.appels.length, 2);
});
