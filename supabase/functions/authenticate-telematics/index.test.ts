import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/authenticate-telematics`;

Deno.test("authenticate-telematics - OPTIONS returns CORS headers", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  await response.text(); // Consume body
});

Deno.test("authenticate-telematics - missing required fields returns 400", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ provider: "geotab" }),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
  assertExists(data.error);
  assertEquals(data.error, "Missing required fields");
});

Deno.test("authenticate-telematics - missing provider returns 400", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      username: "test@test.com",
      password: "testpassword",
    }),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
});

Deno.test("authenticate-telematics - geotab requires database field", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      provider: "geotab",
      username: "test@test.com",
      password: "testpassword",
      // database is missing
    }),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
  assertEquals(data.error, "Database is required for Geotab");
});

Deno.test("authenticate-telematics - unsupported provider returns 400", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      provider: "unknown_provider",
      username: "test",
      password: "test",
    }),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
  assertEquals(data.error, "Unsupported provider");
});

Deno.test("authenticate-telematics - invalid geotab credentials returns 401", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      provider: "geotab",
      database: "fake_database_12345",
      username: "invalid@test.com",
      password: "wrong_password_xyz",
    }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertEquals(data.success, false);
  assertExists(data.error);
});

Deno.test("authenticate-telematics - invalid samsara token returns 401", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      provider: "samsara",
      username: "api_user",
      password: "invalid_samsara_token_12345",
    }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertEquals(data.success, false);
});

Deno.test("authenticate-telematics - empty body returns 500", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: "",
  });

  // Empty body will cause JSON parse error
  assertEquals(response.status, 500);
  await response.text(); // Consume body
});
