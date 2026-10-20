import { describe, expect, it } from "vitest";
import {
  InvalidEmailError,
  createMemoryEmailSender,
  createStoreEmailSender,
  type EmailSender,
} from "./index";

const implementations: [string, () => EmailSender][] = [
  ["memory", () => createMemoryEmailSender()],
  ["store", () => createStoreEmailSender("store", () => Promise.resolve("id-1"))],
];

describe.each(implementations)("contrat EmailSender — %s", (_name, make) => {
  const ok = { to: "dirigeant@pme.ma", subject: "Votre code", text: "123456" };

  it("envoie un message valide et renvoie un identifiant", async () => {
    const { id } = await make().send(ok);
    expect(id).toBeTruthy();
  });

  it.each([
    [{ ...ok, to: "pas-une-adresse" }, /adresse/],
    [{ ...ok, subject: "Code\r\nBcc: x@y.ma" }, /saut de ligne/],
    [{ ...ok, to: "a@b.ma\nBcc: x@y.ma" }, /adresse|saut/],
    [{ ...ok, subject: "  " }, /objet vide/],
    [{ ...ok, text: "" }, /corps vide/],
  ])("refuse %o", async (message, reason) => {
    await expect(make().send(message)).rejects.toThrow(InvalidEmailError);
    await expect(make().send(message)).rejects.toThrow(reason);
  });
});

it("la mémoire conserve les messages envoyés", async () => {
  const sender = createMemoryEmailSender();
  await sender.send({ to: "a@b.ma", subject: "s", text: "t" });
  expect(sender.sent).toHaveLength(1);
  expect(sender.name).toBe("memory");
});
