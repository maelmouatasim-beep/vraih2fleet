/**
 * Envoi de courriels derrière une interface : l'application ne connaît que
 * `EmailSender`. Implémentations : mémoire (tests), boîte d'envoi de
 * démonstration (dépôt en base, câblée par l'application) ; Resend en
 * phase 7. Toutes passent la même suite de contrat (`contract.test.ts`).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string }>;
}

export class InvalidEmailError extends Error {
  constructor(reason: string) {
    super(`Courriel refusé : ${reason}`);
    this.name = "InvalidEmailError";
  }
}

const ADDRESS = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;

/** Refuse les adresses invalides et toute injection d'en-tête (CR/LF). */
export function validateEmailMessage(message: EmailMessage): EmailMessage {
  if (!ADDRESS.test(message.to)) throw new InvalidEmailError("adresse invalide");
  if (/[\r\n]/.test(message.subject) || /[\r\n]/.test(message.to)) {
    throw new InvalidEmailError("saut de ligne dans un en-tête");
  }
  if (message.subject.trim() === "") throw new InvalidEmailError("objet vide");
  if (message.text.trim() === "") throw new InvalidEmailError("corps vide");
  return message;
}

/** Délègue le stockage à `store` (par exemple la table dev.outbox). */
export function createStoreEmailSender(
  name: string,
  store: (message: EmailMessage) => Promise<string>,
): EmailSender {
  return {
    name,
    async send(message) {
      return { id: await store(validateEmailMessage(message)) };
    },
  };
}

export function createMemoryEmailSender(): EmailSender & { readonly sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  const sender = createStoreEmailSender("memory", (message) => {
    sent.push(message);
    return Promise.resolve(String(sent.length));
  });
  return { ...sender, sent };
}
