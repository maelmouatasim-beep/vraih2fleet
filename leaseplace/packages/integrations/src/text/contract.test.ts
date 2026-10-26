import { describe, expect, it } from "vitest";
import {
  InvalidTextError,
  TEXT_MAX_LENGTH,
  createMemoryTextSender,
  createStoreTextSender,
  type TextChannel,
  type TextSender,
} from "./index";

const implementations: [string, () => TextSender][] = [
  ["memory", () => createMemoryTextSender()],
  ["store", () => createStoreTextSender("store", () => Promise.resolve("id-1"))],
];

describe.each(implementations)("contrat TextSender — %s", (_name, make) => {
  const ok = {
    channel: "sms" as TextChannel,
    to: "+212612345678",
    text: "Nouvelle offre : https://x.ma/d/1",
  };

  it("envoie un SMS ou un message WhatsApp valide", async () => {
    expect((await make().send(ok)).id).toBeTruthy();
    expect((await make().send({ ...ok, channel: "whatsapp" })).id).toBeTruthy();
    expect((await make().send({ ...ok, text: "Ligne 1\nLigne 2" })).id).toBeTruthy();
  });

  it.each([
    [{ ...ok, channel: "fax" as TextChannel }, /canal/],
    [{ ...ok, to: "0612345678" }, /numéro/],
    [{ ...ok, to: "+212 612345678" }, /numéro/],
    [{ ...ok, text: "   " }, /vide/],
    [{ ...ok, text: "x".repeat(TEXT_MAX_LENGTH + 1) }, /trop long/],
    [{ ...ok, text: "Bonjour\u0007" }, /contrôle/],
  ])("refuse %o", async (message, reason) => {
    await expect(make().send(message)).rejects.toThrow(InvalidTextError);
    await expect(make().send(message)).rejects.toThrow(reason);
  });
});

it("la mémoire conserve les messages envoyés", async () => {
  const sender = createMemoryTextSender();
  await sender.send({ channel: "whatsapp", to: "+212700112233", text: "t" });
  expect(sender.sent).toHaveLength(1);
  expect(sender.name).toBe("memory");
});
