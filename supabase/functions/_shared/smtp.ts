// Envoi de courriels applicatifs par SMTP (IONOS, port 465 TLS implicite).
// Configuration : _shared/smtpConfig.ts. Les adresses des destinataires ne
// sont jamais écrites dans les journaux.
import nodemailer from "npm:nodemailer@6.9.16";
import { classerErreurSmtp, type ConfigSmtp, type ErreurSmtp } from "./smtpConfig.ts";

export interface Message {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export class EchecSmtp extends Error {
  constructor(public readonly type: ErreurSmtp, message: string) {
    super(message);
  }
}

export async function envoyerSmtp(config: ConfigSmtp, m: Message): Promise<void> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    // Certificat toujours vérifié ; en test local seulement, l'AC du faux
    // serveur remplace les autorités publiques.
    tls: { servername: config.host, minVersion: "TLSv1.2", ...(config.caTests ? { ca: [config.caTests] } : {}) },
  });
  try {
    await transport.sendMail({
      from: { name: config.fromName, address: config.from },
      to: m.to,
      subject: m.subject,
      text: m.text,
      html: m.html,
      replyTo: m.replyTo,
    });
  } catch (e) {
    const type = classerErreurSmtp(e);
    // Code technique seulement (le texte du serveur peut citer des adresses).
    console.error(`SMTP : échec d'envoi (${type}, ${(e as { code?: string }).code ?? "?"})`);
    throw new EchecSmtp(type, type);
  } finally {
    transport.close();
  }
}
