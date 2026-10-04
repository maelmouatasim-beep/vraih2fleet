// Audit acheteur, point 6 — appliquer une stratégie en UNE écriture
// atomique : RLS respectée (security invoker), tout ou rien.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { createTestUser, type TestUser } from "./helpers.ts";

async function orgDe(user: TestUser): Promise<string> {
  const { data } = await user.client.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).single();
  return data!.organization_id;
}

async function projetAvecVehicules(user: TestUser, n: number, prefixe = "L"): Promise<{ projet: string; lignes: string[] }> {
  const org = await orgDe(user);
  const { data: p, error } = await user.client
    .from("projects")
    .insert({ name: "Projet lot", user_id: user.id, organization_id: org })
    .select("id")
    .single();
  if (error) throw error;
  const { data: vs, error: e2 } = await user.client
    .from("vehicles")
    .insert(Array.from({ length: n }, (_, i) => ({ organization_id: org, unit_number: `${prefixe}-${i}`, category: "camionnette", fuel_type: "diesel" })))
    .select("id");
  if (e2) throw e2;
  const { data: pvs, error: e3 } = await user.client
    .from("project_vehicles")
    .insert(vs!.map((v) => ({ project_id: p.id, vehicle_id: v.id, replacement_year: 2027 })))
    .select("id");
  if (e3) throw e3;
  return { projet: p.id, lignes: pvs!.map((x) => x.id) };
}

Deno.test("lot : 300 changements appliqués en un appel par l'éditeur du projet", async () => {
  const a = await createTestUser("lot-1");
  const { projet, lignes } = await projetAvecVehicules(a, 300);
  const changes = lignes.map((id, i) => ({ id, target_technology: i % 2 ? "bev" : "diesel", replacement_year: 2028 + (i % 3) }));
  const { data, error } = await a.client.rpc("apply_project_vehicle_changes", { _project: projet, _changes: changes });
  if (error) throw error;
  assertEquals(data, 300);
  const { data: lu } = await a.client.from("project_vehicles").select("id, target_technology, replacement_year").eq("project_id", projet);
  const parId = new Map(lu!.map((x) => [x.id, x]));
  assertEquals(parId.get(lignes[1])!.target_technology, "bev");
  assertEquals(parId.get(lignes[2])!.replacement_year, 2030);
});

Deno.test("lot : tout ou rien — un étranger au projet ne modifie rien, une ligne hors projet annule tout", async () => {
  const a = await createTestUser("lot-2");
  const b = await createTestUser("lot-2b");
  const { projet, lignes } = await projetAvecVehicules(a, 3);
  const autre = await projetAvecVehicules(a, 1, "M");
  const { error: refus } = await b.client.rpc("apply_project_vehicle_changes", {
    _project: projet,
    _changes: [{ id: lignes[0], target_technology: "bev" }],
  });
  assert(refus, "un non-membre ne doit pas pouvoir appliquer de changement");
  const { error: mixte } = await a.client.rpc("apply_project_vehicle_changes", {
    _project: projet,
    _changes: [
      { id: lignes[0], target_technology: "bev" },
      { id: autre.lignes[0], target_technology: "bev" }, // hors projet
    ],
  });
  assert(mixte, "une ligne hors projet doit annuler tout le lot");
  const { data: lu } = await a.client.from("project_vehicles").select("target_technology").eq("id", lignes[0]).single();
  assertEquals(lu!.target_technology, null);
});
