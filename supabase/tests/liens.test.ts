// Liens des courriels : URL propres en production, « #/ » sur GitHub Pages.
import { assertEquals } from "jsr:@std/assert@1";
import { lienApplication } from "../functions/_shared/liens.ts";

Deno.test("liens des courriels selon le site", () => {
  assertEquals(lienApplication("https://h2fleet.ca", "/signup"), "https://h2fleet.ca/signup");
  assertEquals(lienApplication("https://h2fleet.ca/", "dashboard/projects/x/suivi"), "https://h2fleet.ca/dashboard/projects/x/suivi");
  assertEquals(lienApplication("https://maelmouatasim-beep.github.io/vraih2fleet", "/signup"), "https://maelmouatasim-beep.github.io/vraih2fleet/#/signup");
});
