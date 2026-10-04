// CORS : origines exactes et aperçus Cloudflare Pages (« https://*.domaine »).
// Test pur (aucun appel réseau).
import { assert, assertFalse } from "jsr:@std/assert@1";
import { origineAutorisee } from "../functions/_shared/cors.ts";

const LISTE = ["https://h2fleet.ca", "https://www.h2fleet.ca", "https://*.h2fleet.pages.dev", "http://localhost:8080"];

Deno.test("CORS : origines exactes", () => {
  assert(origineAutorisee("https://h2fleet.ca", LISTE));
  assert(origineAutorisee("http://localhost:8080", LISTE));
  assertFalse(origineAutorisee("https://h2fleet.ca.evil.example", LISTE));
  assertFalse(origineAutorisee("http://h2fleet.ca", LISTE));
  assertFalse(origineAutorisee("", LISTE));
});

Deno.test("CORS : un seul niveau de sous-domaine HTTPS pour « https://*. »", () => {
  assert(origineAutorisee("https://claude-code-integration.h2fleet.pages.dev", LISTE));
  assert(origineAutorisee("https://3f2a1b9c.h2fleet.pages.dev", LISTE));
  assertFalse(origineAutorisee("https://h2fleet.pages.dev", LISTE)); // domaine nu
  assertFalse(origineAutorisee("https://a.b.h2fleet.pages.dev", LISTE)); // sous-sous-domaine
  assertFalse(origineAutorisee("http://abc.h2fleet.pages.dev", LISTE)); // pas HTTPS
  assertFalse(origineAutorisee("https://abc.autre.pages.dev", LISTE));
  assertFalse(origineAutorisee("https://abch2fleet.pages.dev", LISTE));
});

Deno.test("CORS : « * » seul n'est jamais un joker", () => {
  assertFalse(origineAutorisee("https://n-importe.quoi", ["*"]));
});
