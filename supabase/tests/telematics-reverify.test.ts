// Revue D5 : provenance « a_reverifier » acceptée pour les lignes
// télématiques antérieures à la correction de la phase 2c ; toute autre
// valeur reste refusée.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { createTestUser } from "./helpers.ts";

Deno.test("D5 : consumption_source accepte a_reverifier, refuse le reste", async () => {
  const a = await createTestUser("telem-1");
  const { data: cnx, error: eCnx } = await a.client
    .from("telematics_connections")
    .insert({ user_id: a.id, provider: "geotab", username: "test", encrypted_credentials: "e30=" })
    .select("id")
    .single();
  assertEquals(eCnx, null, `connexion refusée : ${eCnx?.message}`);
  const base = {
    connection_id: cnx!.id,
    user_id: a.id,
    vehicle_type: "Light Van",
    make_model: "Ford E-Transit",
    route_type: "Urban",
  };
  const { error: eOk } = await a.client
    .from("telematics_vehicles")
    .insert({ ...base, external_id: "R-1", consumption_source: "a_reverifier" });
  assertEquals(eOk, null, `a_reverifier refusé : ${eOk?.message}`);
  const { error: eKo } = await a.client
    .from("telematics_vehicles")
    .insert({ ...base, external_id: "R-2", consumption_source: "inventee" });
  assert(eKo, "une provenance hors liste doit être refusée");
});
