// Garages (test terrain, bloc 2.1) — RLS de l'organisation et
// synchronisation dépôt ↔ garage des véhicules.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { createTestUser, type TestUser } from "./helpers.ts";

async function orgDe(user: TestUser): Promise<string> {
  const { data } = await user.client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  return data!.organization_id;
}

Deno.test("un membre crée un garage (nom normalisé) ; un tiers ne le voit pas", async () => {
  const a = await createTestUser("garage-1");
  const b = await createTestUser("garage-1b");
  const org = await orgDe(a);
  const { data, error } = await a.client
    .from("garages")
    .insert({ organization_id: org, name: "  Garage   municipal ", available_power_kw: 40, return_time: "17:00", departure_time: "07:00" })
    .select()
    .single();
  if (error) throw error;
  assertEquals(data.name, "Garage municipal");
  const { data: vus } = await b.client.from("garages").select("id").eq("id", data.id);
  assertEquals(vus?.length ?? 0, 0);
  const { error: e2 } = await b.client.from("garages").insert({ organization_id: org, name: "Intrus" });
  assert(e2, "un tiers ne crée pas de garage dans l'organisation d'autrui");
});

Deno.test("nom unique par organisation, casse et espaces ignorés", async () => {
  const a = await createTestUser("garage-2");
  const org = await orgDe(a);
  await a.client.from("garages").insert({ organization_id: org, name: "Travaux publics" });
  const { error } = await a.client.from("garages").insert({ organization_id: org, name: "travaux  PUBLICS" });
  assert(error, "doublon refusé");
});

Deno.test("véhicule : dépôt saisi rattaché au garage du même nom ; renommer le garage renomme le dépôt", async () => {
  const a = await createTestUser("garage-3");
  const org = await orgDe(a);
  const { data: g } = await a.client
    .from("garages")
    .insert({ organization_id: org, name: "Hôtel de ville" })
    .select("id")
    .single();
  const { data: v, error } = await a.client
    .from("vehicles")
    .insert({ organization_id: org, unit_number: `HV-${Date.now()}`, category: "vehicule_leger", depot: "hôtel DE ville" })
    .select("depot, garage_id")
    .single();
  if (error) throw error;
  assertEquals(v.garage_id, g!.id);
  assertEquals(v.depot, "Hôtel de ville");
  await a.client.from("garages").update({ name: "Mairie" }).eq("id", g!.id);
  const { data: apres } = await a.client.from("vehicles").select("depot").eq("garage_id", g!.id).single();
  assertEquals(apres!.depot, "Mairie");
});

Deno.test("un véhicule ne peut pas être rattaché au garage d'une autre organisation", async () => {
  const a = await createTestUser("garage-4");
  const b = await createTestUser("garage-4b");
  const { data: gB } = await b.client
    .from("garages")
    .insert({ organization_id: await orgDe(b), name: "Garage B" })
    .select("id")
    .single();
  const { error } = await a.client
    .from("vehicles")
    .insert({ organization_id: await orgDe(a), unit_number: `X-${Date.now()}`, category: "camionnette", garage_id: gB!.id });
  assert(error, "rattachement inter-organisations refusé");
});
