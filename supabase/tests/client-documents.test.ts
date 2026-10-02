// Phase 5.4 — pièces justificatives (factures, devis) : stockage privé
// par organisation, registre sous RLS, pièce IMMUABLE une fois confirmée
// (confirmation signée par la base), aucune suppression ; fonction
// `document-reader` : 401 / 403 / 404 / 503 propre.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { adminClient, callFunction, createTestUser, type TestUser } from "./helpers.ts";

async function orgDe(user: TestUser): Promise<string> {
  const { data } = await user.client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  return data!.organization_id;
}

const PDF = new TextEncoder().encode("%PDF-1.4\n% facture de test\n");
const SHA = "a".repeat(64);

async function deposer(user: TestUser, org: string, nom = "facture.pdf") {
  const chemin = `${org}/${crypto.randomUUID()}.pdf`;
  const up = await user.client.storage.from("client-documents").upload(chemin, PDF, { contentType: "application/pdf" });
  return { chemin, erreurStockage: up.error };
}

Deno.test("pièces : dépôt et lecture par l'organisation seulement ; lecteur sans écriture", async () => {
  const a = await createTestUser("docs-1");
  const org = await orgDe(a);
  const { chemin, erreurStockage } = await deposer(a, org);
  assertEquals(erreurStockage, null);
  const { data: doc, error } = await a.client
    .from("client_documents")
    .insert({ organization_id: org, kind: "fuel_invoice", storage_path: chemin, file_name: "facture.pdf", mime_type: "application/pdf", size_bytes: PDF.length, sha256: SHA })
    .select()
    .single();
  assertEquals(error, null);
  assertEquals(doc!.status, "pending");
  assertEquals(doc!.uploaded_by, a.id);

  // Une autre organisation : ni le registre, ni le fichier
  const b = await createTestUser("docs-1b");
  const { data: vus } = await b.client.from("client_documents").select("id").eq("id", doc!.id);
  assertEquals(vus, []);
  const { error: errFichier } = await b.client.storage.from("client-documents").download(chemin);
  assert(errFichier, "un autre compte ne doit pas lire le fichier");
  // ni déposer dans le dossier de l'organisation
  const { erreurStockage: errDepot } = await deposer(b, org);
  assert(errDepot, "dépôt dans le dossier d'une autre organisation refusé");
  // chemin hors du dossier de l'organisation : refusé par la base
  const bOrg = await orgDe(b);
  const { chemin: cheminB } = await deposer(b, bOrg);
  const { error: errChemin } = await b.client
    .from("client_documents")
    .insert({ organization_id: bOrg, kind: "fuel_invoice", storage_path: cheminB.replace(bOrg, org), file_name: "x.pdf", mime_type: "application/pdf", size_bytes: 10, sha256: SHA });
  assert(errChemin, "le chemin doit commencer par l'organisation");

  // Lecteur : lit, n'ajoute rien
  const lecteur = await createTestUser("docs-1c");
  await adminClient().from("organization_members").insert({ organization_id: org, user_id: lecteur.id, role: "reader" });
  const { data: luParLecteur } = await lecteur.client.from("client_documents").select("id").eq("id", doc!.id);
  assertEquals(luParLecteur?.length, 1);
  const { erreurStockage: errLecteur } = await deposer(lecteur, org);
  assert(errLecteur, "un lecteur ne dépose pas de pièce");
});

Deno.test("pièces : confirmée = immuable, signée par la base ; jamais supprimée", async () => {
  const a = await createTestUser("docs-2");
  const org = await orgDe(a);
  const { chemin } = await deposer(a, org);
  const { data: doc } = await a.client
    .from("client_documents")
    .insert({ organization_id: org, kind: "grid_quote", storage_path: chemin, file_name: "devis.pdf", mime_type: "application/pdf", size_bytes: PDF.length, sha256: SHA })
    .select()
    .single();
  const { data: conf, error } = await a.client
    .from("client_documents")
    .update({ status: "confirmed", supplier: "Hydro-Québec", applied: [{ cible: "Garage", champ: "grid_connection_quote", avant: null, apres: 85000 }] })
    .eq("id", doc!.id)
    .select()
    .single();
  assertEquals(error, null);
  assertEquals(conf!.confirmed_by, a.id);
  assert(conf!.confirmed_at);
  // plus aucune modification
  const { error: errModif } = await a.client.from("client_documents").update({ supplier: "Autre" }).eq("id", doc!.id);
  assert(errModif, "une pièce confirmée est immuable");
  // aucune suppression (ni du registre ni du fichier)
  await a.client.from("client_documents").delete().eq("id", doc!.id);
  const { data: encore } = await a.client.from("client_documents").select("id").eq("id", doc!.id);
  assertEquals(encore?.length, 1);
  await a.client.storage.from("client-documents").remove([chemin]);
  const { error: errLecture } = await a.client.storage.from("client-documents").download(chemin);
  assertEquals(errLecture, null);
  // devis de véhicule : prix et technologie vont ensemble
  const { data: p } = await a.client.from("projects").insert({ name: "Devis", user_id: a.id, organization_id: org }).select("id").single();
  const { data: v } = await a.client
    .from("vehicles")
    .insert({ organization_id: org, unit_number: "D-1", category: "camionnette", fuel_type: "diesel" })
    .select("id")
    .single();
  const { data: pv } = await a.client.from("project_vehicles").insert({ project_id: p!.id, vehicle_id: v!.id }).select("id").single();
  const { error: errIncomplet } = await a.client.from("project_vehicles").update({ quote_price: 78500 }).eq("id", pv!.id);
  assert(errIncomplet, "prix devisé sans technologie refusé");
  const { error: errOk } = await a.client
    .from("project_vehicles")
    .update({ quote_price: 78500, quote_technology: "bev", quote_document_id: doc!.id })
    .eq("id", pv!.id);
  assertEquals(errOk, null);
});

Deno.test("fonction document-reader : 401 sans jeton, 403 si désactivée, 404 pièce d'autrui, 503 propre sans clé", async () => {
  const a = await createTestUser("docs-3");
  const org = await orgDe(a);
  const { chemin } = await deposer(a, org);
  const { data: doc } = await a.client
    .from("client_documents")
    .insert({ organization_id: org, kind: "fuel_invoice", storage_path: chemin, file_name: "f.pdf", mime_type: "application/pdf", size_bytes: PDF.length, sha256: SHA })
    .select("id")
    .single();
  const corps = (o: string, d: string) => ({ organizationId: o, documentId: d, texte: null });
  const sansJeton = await callFunction("document-reader", corps(org, doc!.id));
  assertEquals(sansJeton.status, 401);
  await sansJeton.body?.cancel();
  const desactivee = await callFunction("document-reader", corps(org, doc!.id), { Authorization: `Bearer ${a.token}` });
  assertEquals(desactivee.status, 403);
  assertEquals((await desactivee.json()).error, "fonction_desactivee");
  await a.client.from("organization_ai_settings").insert({ organization_id: org, document_reading_enabled: true });
  const sansCle = await callFunction("document-reader", corps(org, doc!.id), { Authorization: `Bearer ${a.token}` });
  assertEquals(sansCle.status, 503);
  assertEquals((await sansCle.json()).error, "service_non_configure");
  // pièce d'une autre organisation, avec la fonction activée chez soi
  const b = await createTestUser("docs-3b");
  const bOrg = await orgDe(b);
  await b.client.from("organization_ai_settings").insert({ organization_id: bOrg, document_reading_enabled: true });
  const croise = await callFunction("document-reader", corps(bOrg, doc!.id), { Authorization: `Bearer ${b.token}` });
  assertEquals(croise.status, 404);
  assertEquals((await croise.json()).error, "document_introuvable");
});
