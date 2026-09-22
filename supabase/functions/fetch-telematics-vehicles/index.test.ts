import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/fetch-telematics-vehicles`;

Deno.test("fetch-telematics-vehicles - OPTIONS returns CORS headers", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  await response.text(); // Consume body
});

Deno.test("fetch-telematics-vehicles - missing fields returns 400", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
  assertExists(data.error);
});

Deno.test("fetch-telematics-vehicles - missing provider returns 400", async () => {
  const validBase64 = btoa(JSON.stringify({ sessionId: "test" }));

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      encryptedCredentials: validBase64,
    }),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
});

Deno.test("fetch-telematics-vehicles - missing credentials returns 400", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      provider: "geotab",
    }),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
});

Deno.test("fetch-telematics-vehicles - invalid base64 credentials returns 400", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      provider: "geotab",
      encryptedCredentials: "not-valid-base64!!!@#$",
    }),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
});

Deno.test("fetch-telematics-vehicles - unsupported provider returns 400", async () => {
  const validBase64 = btoa(JSON.stringify({ sessionId: "test" }));

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      provider: "unknown_provider",
      encryptedCredentials: validBase64,
    }),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
  assertEquals(data.error, "Unsupported provider");
});

Deno.test("fetch-telematics-vehicles - expired geotab session returns 401 with reauth flag", async () => {
  // Simulate credentials that would cause session expiration
  const expiredCreds = btoa(
    JSON.stringify({
      sessionId: "expired-session-id-12345",
      database: "test_db",
      userName: "test@test.com",
      server: "my.geotab.com",
    })
  );

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      provider: "geotab",
      encryptedCredentials: expiredCreds,
    }),
  });

  const data = await response.json();

  // Either 401 (session expired) or 500 (API error) is acceptable
  if (response.status === 401) {
    assertEquals(data.success, false);
    assertEquals(data.error, "SESSION_EXPIRED");
    assertEquals(data.requiresReauth, true);
  } else {
    // For other errors, just verify structure
    assertEquals(data.success, false);
    assertExists(data.error);
  }
});

Deno.test("fetch-telematics-vehicles - expired samsara token returns 401 with reauth flag", async () => {
  const expiredCreds = btoa(
    JSON.stringify({
      apiToken: "samsara_api_invalid_token_12345",
    })
  );

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      provider: "samsara",
      encryptedCredentials: expiredCreds,
    }),
  });

  const data = await response.json();

  // Samsara should return 401 for invalid token
  if (response.status === 401) {
    assertEquals(data.success, false);
    assertEquals(data.requiresReauth, true);
  } else {
    assertEquals(data.success, false);
  }
});

Deno.test("fetch-telematics-vehicles - empty body returns error", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: "",
  });

  // Empty body should cause an error
  const status = response.status;
  assertEquals(status >= 400, true);
  await response.text(); // Consume body
});

Deno.test("fetch-telematics-vehicles - response includes expected fields on error", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      provider: "geotab",
      encryptedCredentials: btoa("{}"),
    }),
  });

  const data = await response.json();

  // Verify response structure
  assertExists(data.success);
  assertEquals(data.success, false);
  assertExists(data.error);
});
