// Tests d'intégration contre Supabase LOCAL uniquement (voir helpers.ts).
// SMTP_PASSWORD est absent en test (functions.env) : aucun envoi réel.
// L'envoi par SMTP est testé contre un faux serveur : supabase/tests/smtp-envoi.test.ts.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  adminClient,
  callFunction,
  createTestUser,
} from "../../tests/helpers.ts";

Deno.test("send-email - gabarit inconnu => 400 (liste fermée)", async () => {
  const response = await callFunction("send-email", {
    templateType: "custom",
    data: { to: "victime@example.com", htmlContent: "<script>x</script>" },
  });
  assertEquals(response.status, 400);
  await response.text();
});

Deno.test("send-email - l'ancien format ouvert (to/subject/htmlContent) => 400", async () => {
  const response = await callFunction("send-email", {
    to: "victime@example.com",
    subject: "spam",
    htmlContent: "<b>spam</b>",
  });
  assertEquals(response.status, 400);
  await response.text();
});

Deno.test("send-email - pot de miel rempli => succès silencieux, rien d'enregistré", async () => {
  const email = `bot-${Date.now()}@example.com`;
  const response = await callFunction("send-email", {
    templateType: "demo_request",
    data: {
      fullName: "Robot",
      email,
      company: "SpamCo",
      fleetSize: "10-50",
      website: "http://spam.example", // pot de miel
    },
  });
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.success, true);

  const { data } = await adminClient()
    .from("email_leads")
    .select("id")
    .eq("email", email);
  assertEquals(data?.length ?? 0, 0, "un lead a été créé pour un robot");
});

Deno.test("send-email - demo_request : email invalide => 400", async () => {
  const response = await callFunction("send-email", {
    templateType: "demo_request",
    data: { fullName: "X", email: "pas-un-email", company: "Y", fleetSize: "10" },
  });
  assertEquals(response.status, 400);
  await response.text();
});

Deno.test("send-email - demo_request valide sans SMTP : lead enregistré, succès emailSent=false", async () => {
  const email = `lead-${Date.now()}@example.com`;
  const response = await callFunction("send-email", {
    templateType: "demo_request",
    data: { fullName: "Prospect", email, company: "FlotteCo", fleetSize: "50-200" },
  });
  // SMTP_PASSWORD absent en test : la demande est enregistrée et le
  // serveur le dit (pas d'erreur 500 pour un service non branché).
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body, { success: true, emailSent: false });

  const { data } = await adminClient()
    .from("email_leads")
    .select("email, source")
    .eq("email", email);
  assertEquals(data?.length, 1, "le lead de démo doit être enregistré");
  assertEquals(data![0].source, "demo_request");
});

Deno.test("send-email - subsidy_reminder sans secret interne => 401", async () => {
  const response = await callFunction("send-email", {
    templateType: "subsidy_reminder",
    data: {
      to: "user@example.com",
      programName: "P",
      amount: "10 000 $",
      daysRemaining: 7,
      deadline: "1er juin",
      applyUrl: "https://example.com",
      isUrgent: false,
      lang: "fr",
    },
  });
  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("send-email - subsidy_reminder avec mauvais secret => 401", async () => {
  const response = await callFunction(
    "send-email",
    {
      templateType: "subsidy_reminder",
      data: {
        to: "user@example.com",
        programName: "P",
        amount: "10 000 $",
        daysRemaining: 7,
        deadline: "1er juin",
        applyUrl: "https://example.com",
        isUrgent: false,
        lang: "fr",
      },
    },
    { "x-internal-secret": "mauvais-secret" },
  );
  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("send-email - task_mention sans JWT => 401", async () => {
  const response = await callFunction("send-email", {
    templateType: "task_mention",
    data: {
      taskId: crypto.randomUUID(),
      mentionedUserId: crypto.randomUUID(),
      commentPreview: "hello",
    },
  });
  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("send-email - task_mention avec JWT mais tâche d'autrui => 404", async () => {
  const user = await createTestUser("mention");
  const response = await callFunction(
    "send-email",
    {
      templateType: "task_mention",
      data: {
        taskId: crypto.randomUUID(),
        mentionedUserId: crypto.randomUUID(),
        commentPreview: "hello",
      },
    },
    { Authorization: `Bearer ${user.token}` },
  );
  assertEquals(response.status, 404);
  await response.text();
});

Deno.test("send-email - collaboration_invite d'une invitation d'autrui => 404", async () => {
  const user = await createTestUser("invite");
  const response = await callFunction(
    "send-email",
    {
      templateType: "collaboration_invite",
      data: { invitationId: crypto.randomUUID() },
    },
    { Authorization: `Bearer ${user.token}` },
  );
  assertEquals(response.status, 404);
  await response.text();
});

Deno.test("send-email - rate limit IP : bloque après 5 requêtes publiques", async () => {
  // Le pot de miel n'incrémente pas le compteur ; on utilise des requêtes
  // valides (200 emailSent=false sans SMTP, mais comptées) puis on
  // vérifie le 429.
  let got429 = false;
  for (let i = 0; i < 8; i++) {
    const response = await callFunction("send-email", {
      templateType: "contact",
      data: {
        name: "X",
        email: `ratelimit-${Date.now()}-${i}@example.com`,
        subject: "test",
        message: "test",
      },
    });
    await response.text();
    if (response.status === 429) {
      got429 = true;
      break;
    }
  }
  assert(got429, "la limite de débit par IP n'a jamais bloqué");
});

Deno.test("send-email - contact sans SMTP : message conservé dans le lead, emailSent=false", async () => {
  const email = `contact-${Date.now()}@example.com`;
  const response = await callFunction(
    "send-email",
    {
      templateType: "contact",
      data: { name: "Prospect", email, subject: "Question", message: "Texte du message" },
    },
    { "x-forwarded-for": `10.9.${Date.now() % 250}.1` },
  );
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { success: true, emailSent: false });
  const { data } = await adminClient()
    .from("email_leads")
    .select("source, calculator_inputs")
    .eq("email", email);
  assertEquals(data?.length, 1);
  assertEquals((data![0].calculator_inputs as { message?: string }).message, "Texte du message");
});

Deno.test("send-email - support_request sans SMTP => 503 service_non_configure", async () => {
  const user = await createTestUser("support");
  const response = await callFunction(
    "send-email",
    {
      templateType: "support_request",
      data: { category: "Compte", subject: "Aide", message: "Bonjour", isPriority: false },
    },
    { Authorization: `Bearer ${user.token}` },
  );
  assertEquals(response.status, 503);
  assertEquals(await response.json(), { error: "service_non_configure" });
});
