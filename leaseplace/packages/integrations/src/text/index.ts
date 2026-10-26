/**
 * SMS et WhatsApp derrière une seule interface : l'application ne connaît
 * que `TextSender`. Implémentations : mémoire (tests), boîte d'envoi de
 * démonstration (dépôt en base, câblée par l'application). Le fournisseur
 * réel (agrégateur SMS marocain, API WhatsApp Business) reste à choisir ;
 * il devra passer la même suite de contrat (`contract.test.ts`).
 */

export const TEXT_CHANNELS = ["sms", "whatsapp"] as const;
export type TextChannel = (typeof TEXT_CHANNELS)[number];

export interface TextMessage {
  channel: TextChannel;
  /** Numéro au format E.164 (+212…). */
  to: string;
  text: string;
}

export interface TextSender {
  readonly name: string;
  send(message: TextMessage): Promise<{ id: string }>;
}

export class InvalidTextError extends Error {
  constructor(reason: string) {
    super(`Message refusé : ${reason}`);
    this.name = "InvalidTextError";
  }
}

/** Quatre segments SMS au plus : les messages restent courts, avec un lien. */
export const TEXT_MAX_LENGTH = 480;

const E164 = /^\+[1-9]\d{7,14}$/;

export function validateTextMessage(message: TextMessage): TextMessage {
  // Valeur venue de l'extérieur du typage (données en base, formulaire).
  if (!(TEXT_CHANNELS as readonly string[]).includes(message.channel))
    throw new InvalidTextError("canal inconnu");
  if (!E164.test(message.to)) throw new InvalidTextError("numéro invalide");
  if (message.text.trim() === "") throw new InvalidTextError("texte vide");
  if (message.text.length > TEXT_MAX_LENGTH) throw new InvalidTextError("texte trop long");
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(message.text))
    throw new InvalidTextError("caractère de contrôle");
  return message;
}

export function createStoreTextSender(
  name: string,
  store: (message: TextMessage) => Promise<string>,
): TextSender {
  return {
    name,
    async send(message) {
      return { id: await store(validateTextMessage(message)) };
    },
  };
}

export function createMemoryTextSender(): TextSender & { readonly sent: TextMessage[] } {
  const sent: TextMessage[] = [];
  const sender = createStoreTextSender("memory", (message) => {
    sent.push(message);
    return Promise.resolve(String(sent.length));
  });
  return { ...sender, sent };
}
