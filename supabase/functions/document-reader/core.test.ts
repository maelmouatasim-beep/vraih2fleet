// Lecture de factures et de devis (Phase 5.4) — extraction avec un FAUX
// client Claude : nombres retrouvés (ou non) dans le texte, champs hors
// type et garages inventés rejetés, fichier envoyé seulement sans texte.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { contenuUtilisateur, extraireDocument, zCorpsDocument, type DepsDocument } from "./core.ts";
import { SCHEMA_EXTRACTION } from "../_shared/documentSchema.ts";

const ORG = "11111111-1111-4111-8111-111111111111";
const DOC = "33333333-3333-4333-8333-333333333333";

const FACTURE = `Pétroles Laurentides inc. — Facture n° 4471 — 2026-09-15
Livraison diesel coloré au Garage municipal, 12 rue du Quai
Diesel                 4 512,0 L    à 1,4210 $/L
Sous-total avant taxes                 6 411,55 $
TPS (5 %)                                320,58 $
TVQ (9,975 %)                            639,55 $
Total                                  7 371,68 $
Merci de votre confiance. Conditions : net 30 jours. Pour toute question, communiquez avec le service à la clientèle.`;

function deps(reponse: unknown, stop = "end_turn"): DepsDocument & { params: Record<string, unknown>[] } {
  const d = {
    params: [] as Record<string, unknown>[],
    modele: "claude-opus-5-5",
    appelerClaude: (p: Record<string, unknown>) => {
      d.params.push(structuredClone(p));
      return Promise.resolve({ content: [{ type: "text", text: JSON.stringify(reponse) }], stop_reason: stop, model: "claude-opus-5-5", usage: { input_tokens: 1500, output_tokens: 300 } });
    },
    journaliserUsage: () => Promise.resolve(),
  };
  return d;
}

const champ = (c: string, n: number | null, t = "", extrait = "") => ({ champ: c, valeur_nombre: n, valeur_texte: t, extrait, page: 1, certitude: "sure" });

Deno.test("facture de carburant (texte) : nombres retrouvés, inventés signalés, hors type et garage inventé rejetés", async () => {
  const corps = zCorpsDocument.parse({ organizationId: ORG, documentId: DOC, texte: FACTURE, garages: ["Garage municipal", "Travaux publics"] });
  const d = deps({
    type_detecte: "fuel_invoice",
    fournisseur: "Pétroles Laurentides inc.",
    date_document: "2026-09-15",
    garage_propose: "Garage municipal",
    champs: [
      champ("carburant", null, "diesel", "Livraison diesel coloré"),
      champ("litres", 4512, "", "4 512,0 L"),
      champ("montant_avant_taxes", 6411.55, "", "Sous-total avant taxes 6 411,55 $"),
      champ("montant_total", 7999.99, "", "Total"), // jamais imprimé : signalé
      champ("kwh", 1000), // champ d'une facture d'électricité : rejeté
    ],
  });
  const r = await extraireDocument(corps, { type: "fuel_invoice", fichier: null }, d);
  assert(r.type === "extraction");
  assertEquals(r.mode, "texte");
  const par = Object.fromEntries(r.extraction.champs.map((c) => [c.champ, c]));
  assertEquals(par.litres.retrouve, true);
  assertEquals(par.montant_avant_taxes.retrouve, true);
  assertEquals(par.montant_total.retrouve, false);
  assertEquals(par.carburant.retrouve, true);
  assertEquals(par.kwh, undefined);
  assertEquals(r.extraction.garage_propose, "Garage municipal");
  assertEquals(r.rejets, 1);
  // texte seulement (minimisation) ; schéma imposé ; aucun choix d'outil forcé
  const p = d.params[0] as { messages: { content: { type: string }[] }[]; output_config: { format: unknown }; tool_choice?: unknown };
  assertEquals(p.messages[0].content.map((b) => b.type), ["text", "text"]);
  assertEquals(p.output_config.format, { type: "json_schema", schema: SCHEMA_EXTRACTION });
  assertEquals(p.tool_choice, undefined);

  const inventeGarage = await extraireDocument(
    corps,
    { type: "fuel_invoice", fichier: null },
    deps({ type_detecte: "fuel_invoice", fournisseur: "", date_document: "15/09/2026", garage_propose: "Garage fantôme", champs: [] }),
  );
  assert(inventeGarage.type === "extraction");
  assertEquals(inventeGarage.extraction.garage_propose, "");
  assertEquals(inventeGarage.extraction.date_document, "");
});

Deno.test("sans couche texte : le fichier est envoyé (PDF ou image) et rien n'est marqué « retrouvé »", async () => {
  const corps = zCorpsDocument.parse({ organizationId: ORG, documentId: DOC, texte: null });
  const pdf = contenuUtilisateur(corps, { type: "grid_quote", fichier: { base64: "JVBERi0=", mime: "application/pdf" } });
  assertEquals(pdf[0].type, "document");
  const img = contenuUtilisateur(corps, { type: "grid_quote", fichier: { base64: "iVBOR", mime: "image/png" } });
  assertEquals(img[0].type, "image");
  const r = await extraireDocument(
    corps,
    { type: "grid_quote", fichier: { base64: "JVBERi0=", mime: "application/pdf" } },
    deps({ type_detecte: "grid_quote", fournisseur: "Hydro-Québec", date_document: "", garage_propose: "", champs: [champ("montant_avant_taxes", 85000)] }),
  );
  assert(r.type === "extraction");
  assertEquals(r.mode, "fichier");
  assertEquals(r.extraction.champs[0].retrouve, null);
});

Deno.test("refus et réponse invalide : aucune extraction", async () => {
  const corps = zCorpsDocument.parse({ organizationId: ORG, documentId: DOC, texte: FACTURE });
  assertEquals((await extraireDocument(corps, { type: "fuel_invoice", fichier: null }, deps({}, "refusal"))).type, "refus");
  assertEquals((await extraireDocument(corps, { type: "fuel_invoice", fichier: null }, deps({ nimporte: "quoi" }))).type, "invalide");
});
