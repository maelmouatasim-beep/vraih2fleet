import { expect, it } from "vitest";
import { createEicarScanner, EICAR_TEST_STRING } from "./index";

it("détecte la signature EICAR, laisse passer le reste ; signalé comme scanner de test", async () => {
  const s = createEicarScanner();
  expect(s.real).toBe(false);
  expect(await s.scan(new TextEncoder().encode(`%PDF ${EICAR_TEST_STRING}`))).toEqual({
    clean: false,
    signature: "EICAR-Test-File",
  });
  expect(await s.scan(new TextEncoder().encode("%PDF-1.7"))).toEqual({ clean: true });
});
