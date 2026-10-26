import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { uuidv7 } from "uuidv7";
import { schema } from "@leaseplace/db";
import {
  channelsFor,
  DEFAULT_PREFERENCES,
  NOTIFICATION_KINDS,
  type NotificationKind,
  type Role,
} from "@leaseplace/domain";
import { createStoreEmailSender } from "@leaseplace/integrations/email";
import { createStoreTextSender } from "@leaseplace/integrations/text";
import { routing, type Locale } from "@/i18n/routing";
import { brand } from "./brand";
import { authDb } from "./db";
import { env } from "./env";
import { logger } from "./logger";

const { memberships, users, outbox, notifications, notificationPreferences } = schema;

// Boîte d'envoi de démonstration : aucun fournisseur réel n'est branché
// (courriel, SMS et WhatsApp à choisir, cf. docs/questions-ouvertes.md).
const mailer = createStoreEmailSender("dev-outbox", async (message) => {
  const id = uuidv7();
  await authDb()
    .insert(outbox)
    .values({ id, channel: "email", ...message });
  return id;
});
const texter = createStoreTextSender("dev-outbox", async (message) => {
  const id = uuidv7();
  await authDb().insert(outbox).values({
    id,
    channel: message.channel,
    to: message.to,
    subject: message.channel,
    text: message.text,
  });
  return id;
});

/** Paramètres d'un texte : jamais de pièce ni de chiffre du dossier. */
export interface NotificationValues {
  reference: string;
  /** Chemin de l'écran concerné, sans préfixe de langue. */
  path: string;
  lessor?: string;
}

type Messages = { notifications: Record<string, unknown> };
/** Clés construites dynamiquement (`kinds.<type>.title`) : vérifiées par un test. */
type Translate = (key: string, values: Record<string, string>) => string;

/**
 * Prévient les membres d'une organisation (rôles donnés), chacun dans sa
 * langue : notification dans l'application, puis e-mail, SMS ou WhatsApp
 * selon ses préférences. Destinataires et préférences lus par la connexion
 * d'authentification (tables identity) ; appelé APRÈS la transaction
 * métier. Un échec est journalisé sans bloquer l'action.
 */
export async function notify(
  kind: NotificationKind,
  organizationId: string,
  values: NotificationValues,
) {
  const roles = audienceRoles(kind);
  try {
    const recipients = await authDb()
      .select({
        id: users.id,
        email: users.email,
        locale: users.locale,
        prefs: notificationPreferences,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .leftJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
      .where(
        and(eq(memberships.organizationId, organizationId), inArray(memberships.role, [...roles])),
      );
    const params = { reference: values.reference, lessor: values.lessor ?? "" };
    for (const r of recipients) {
      await authDb().insert(notifications).values({
        id: uuidv7(),
        userId: r.id,
        organizationId,
        kind,
        params,
        path: values.path,
      });
      const channels = channelsFor(kind, r.prefs ?? DEFAULT_PREFERENCES);
      if (channels.length === 0) continue;
      const locale: Locale = routing.locales.includes(r.locale) ? r.locale : "fr";
      const messages = ((await import(`../../messages/${locale}.json`)) as { default: Messages })
        .default;
      const t = createTranslator({
        locale,
        messages,
        namespace: "notifications",
      }) as unknown as Translate;
      const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
      const url = `${env().BETTER_AUTH_URL}${prefix}${values.path}`;
      const text = { ...params, brand: brand.name, url };
      for (const channel of channels) {
        if (channel === "email") {
          await mailer.send({
            to: r.email,
            subject: t(`kinds.${kind}.title`, text),
            text: t("emailBody", {
              ...text,
              title: t(`kinds.${kind}.title`, text),
              body: t(`kinds.${kind}.body`, text),
            }),
          });
        } else if (r.prefs?.phone) {
          await texter.send({
            channel,
            to: r.prefs.phone,
            text: t("textBody", { ...text, body: t(`kinds.${kind}.title`, text) }),
          });
        }
      }
    }
  } catch (error) {
    logger.error({ err: error, organizationId, kind }, "notification");
  }
}

/** Destinataires d'un type : toute l'entreprise, ou toute l'équipe du bailleur. */
function audienceRoles(kind: NotificationKind): readonly Role[] {
  return NOTIFICATION_KINDS[kind].audience === "company"
    ? ["company_owner", "company_member"]
    : ["lessor_admin", "lessor_analyst", "lessor_viewer"];
}
