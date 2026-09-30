// Revue D6 : invitations d'équipe au niveau de l'organisation.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { adminClient, createTestUser, type TestUser } from "./helpers.ts";

async function orgOf(user: TestUser): Promise<string> {
  const { data } = await user.client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  return data!.organization_id;
}

Deno.test("D6 : l'admin invite, l'invité accepte et devient membre avec le rôle prévu", async () => {
  const admin = await createTestUser("inv-admin");
  const invite = await createTestUser("inv-invite");
  const tiers = await createTestUser("inv-tiers");
  const org = await orgOf(admin);

  const { data: inv, error } = await admin.client
    .from("organization_invitations")
    .insert({ organization_id: org, email: invite.email.toLowerCase(), role: "reader", invited_by: admin.id })
    .select("id")
    .single();
  assertEquals(error, null, `invitation refusée : ${error?.message}`);

  // un tiers ne la voit pas et ne peut pas l'accepter
  const { data: vueTiers } = await tiers.client.from("organization_invitations").select("id").eq("id", inv!.id);
  assertEquals(vueTiers ?? [], []);
  const { error: eTiers } = await tiers.client.rpc("accept_organization_invitation", { _invitation: inv!.id });
  assert(eTiers, "un tiers ne peut pas accepter l'invitation d'un autre");

  // l'invité la voit et l'accepte
  const { data: vueInvite } = await invite.client.from("organization_invitations").select("id").eq("id", inv!.id);
  assertEquals(vueInvite?.length, 1);
  const { data: orgAcceptee, error: eAcc } = await invite.client.rpc("accept_organization_invitation", {
    _invitation: inv!.id,
  });
  assertEquals(eAcc, null, `acceptation refusée : ${eAcc?.message}`);
  assertEquals(orgAcceptee, org);
  const { data: membre } = await adminClient()
    .from("organization_members")
    .select("role")
    .eq("organization_id", org)
    .eq("user_id", invite.id)
    .single();
  assertEquals(membre?.role, "reader");

  // déjà acceptée : ne peut pas servir deux fois
  const { error: eDeux } = await invite.client.rpc("accept_organization_invitation", { _invitation: inv!.id });
  assert(eDeux, "une invitation acceptée ne resert pas");

  // la liste détaillée donne le courriel des membres, aux membres seulement
  const { data: liste } = await admin.client.rpc("list_organization_members_detail", { _org: org });
  const courriels = (liste ?? []).map((m: { email: string | null }) => (m.email ?? "").toLowerCase());
  assert(courriels.includes(invite.email.toLowerCase()), `courriel du nouveau membre absent : ${courriels.join(", ")}`);
  const { data: listeTiers } = await tiers.client.rpc("list_organization_members_detail", { _org: org });
  assertEquals(listeTiers ?? [], []);
});

Deno.test("D6 : un membre non admin ne peut pas inviter ; une invitation expirée est refusée", async () => {
  const admin = await createTestUser("inv-admin-2");
  const membre = await createTestUser("inv-membre-2");
  const invite = await createTestUser("inv-invite-2");
  const org = await orgOf(admin);
  await adminClient().from("organization_members").insert({ organization_id: org, user_id: membre.id, role: "member" });

  const { error: eMembre } = await membre.client
    .from("organization_invitations")
    .insert({ organization_id: org, email: "quelquun@example.com", invited_by: membre.id });
  assert(eMembre, "un membre non admin ne peut pas inviter");

  const { data: inv } = await adminClient()
    .from("organization_invitations")
    .insert({
      organization_id: org,
      email: invite.email.toLowerCase(),
      invited_by: admin.id,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    })
    .select("id")
    .single();
  const { error: eExp } = await invite.client.rpc("accept_organization_invitation", { _invitation: inv!.id });
  assert(eExp, "une invitation expirée doit être refusée");
});
