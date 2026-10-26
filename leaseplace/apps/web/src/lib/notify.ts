import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { uuidv7 } from "uuidv7";
import { schema } from "@leaseplace/db";
import { createStoreEmailSender } from "@leaseplace/integrations/email";
import { routing, type Locale } from "@/i18n/routing";
import { brand } from "./brand";
import { authDb } from "./db";
import { env } from "./env";
import { logger } from "./logger";

const { memberships, users, outbox } = schema;

// Boîte d'envoi de démonstration (fournisseur réel : phase 7).
const mailer = createStoreEmailSender("dev-outbox", async (message) => {
  const id = uuidv7();
  await authDb()
    .insert(outbox)
    .values({ id, ...message });
  return id;
});

type EmailKey = "newRequest" | "offerReceived";

/**
 * Prévient les membres d'une organisation (rôles donnés), chacun dans sa
 * langue. Lecture des adresses par la connexion d'authentification (tables
 * identity seulement) : l'application n'y a pas accès sous RLS. Un échec
 * d'envoi est journalisé sans bloquer l'action métier.
 */
export async function notifyMembers(
  organizationId: string,
  roles: readonly string[],
  key: EmailKey,
  values: { reference: string; path: string },
) {
  try {
    const recipients = await authDb()
      .select({ email: users.email, locale: users.locale })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(eq(memberships.organizationId, organizationId), inArray(memberships.role, [...roles])),
      );
    for (const r of recipients) {
      const locale: Locale = routing.locales.includes(r.locale) ? r.locale : "fr";
      const messages = (
        (await import(`../../messages/${locale}.json`)) as {
          default: { emails: Record<string, string> };
        }
      ).default;
      const t = createTranslator({ locale, messages, namespace: "emails" });
      const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
      const url = `${env().BETTER_AUTH_URL}${prefix}${values.path}`;
      await mailer.send({
        to: r.email,
        subject: t(`${key}Subject`, { brand: brand.name, reference: values.reference }),
        text: t(`${key}Body`, { brand: brand.name, reference: values.reference, url }),
      });
    }
  } catch (error) {
    logger.error({ err: error, organizationId, key }, "notification par courriel");
  }
}
