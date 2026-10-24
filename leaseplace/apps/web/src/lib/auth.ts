import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, magicLink, organization, twoFactor } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { uuidv7 } from "uuidv7";
import { recordAudit, withActor } from "@leaseplace/db";
import { schema } from "@leaseplace/db";
import { isOrganizationType, requiresTwoFactor } from "@leaseplace/domain";
import { createStoreEmailSender } from "@leaseplace/integrations/email";
import { routing, type Locale } from "@/i18n/routing";
import {
  isPasswordlessAllowed,
  isSessionCreationAllowed,
  isTwoFactorDisableAllowed,
  signInMethodOf,
} from "./auth-policy";
import { brand } from "./brand";
import { appDb, authDb } from "./db";
import { env } from "./env";
import { logger } from "./logger";

const {
  users,
  sessions,
  accounts,
  verifications,
  organizations,
  memberships,
  invitations,
  twoFactors,
  rateLimits,
  outbox,
} = schema;

/** Types d'organisation de l'utilisateur (connexion lp_auth). */
async function organizationTypesOf(userId: string) {
  const rows = await authDb()
    .select({ id: organizations.id, type: organizations.type })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt));
  return rows.filter((r) => isOrganizationType(r.type));
}

async function isStrictTwoFactor(userId: string) {
  return (await organizationTypesOf(userId)).some((o) => requiresTwoFactor(o.type));
}

async function userByEmail(email: string) {
  const [user] = await authDb().select().from(users).where(eq(users.email, email.toLowerCase()));
  return user;
}

// Boîte d'envoi de démonstration tant qu'aucun fournisseur n'est branché (phase 7 : Resend).
const mailer = createStoreEmailSender("dev-outbox", async (message) => {
  const id = uuidv7();
  await authDb()
    .insert(outbox)
    .values({ id, ...message });
  return id;
});

async function emailTranslator(email: string) {
  const user = await userByEmail(email);
  const locale: Locale = user && routing.locales.includes(user.locale) ? user.locale : "fr";
  const messages = (
    (await import(`../../messages/${locale}.json`)) as {
      default: { emails: Record<string, string> };
    }
  ).default;
  return createTranslator({ locale, messages, namespace: "emails" });
}

/**
 * Lien ou code par courriel : jamais pour un compte à 2FA obligatoire, et
 * jamais pour une adresse inconnue (inscription fermée en phase 1). Aucune
 * différence de réponse : pas d'énumération des comptes.
 */
async function passwordlessRecipient(email: string) {
  const user = await userByEmail(email);
  if (!user) return null;
  if (!isPasswordlessAllowed(await isStrictTwoFactor(user.id))) return null;
  return user;
}

async function audit(
  userId: string,
  entry: Parameters<typeof recordAudit>[1],
  context: { ip?: string | null; userAgent?: string | null; organizationId?: string | null } = {},
) {
  try {
    await withActor(appDb(), { userId, ...context }, (tx) => recordAudit(tx, entry));
  } catch (error) {
    // L'audit ne doit jamais être silencieux : on journalise l'échec.
    logger.error({ err: error, action: entry.action }, "audit.record a échoué");
    throw error;
  }
}

function createAuth() {
  return betterAuth({
    appName: brand.name,
    baseURL: env().BETTER_AUTH_URL,
    secret: env().BETTER_AUTH_SECRET,
    trustedOrigins: [env().BETTER_AUTH_URL],
    telemetry: { enabled: false },
    database: drizzleAdapter(authDb(), {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        organization: organizations,
        member: memberships,
        invitation: invitations,
        twoFactor: twoFactors,
        rateLimit: rateLimits,
      },
    }),
    advanced: {
      cookiePrefix: "lp",
      useSecureCookies: env().NODE_ENV === "production",
      database: { generateId: () => uuidv7() },
    },
    user: {
      additionalFields: {
        locale: { type: "string", required: false, defaultValue: "fr", input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    emailAndPassword: {
      enabled: true,
      // Phase 1 : comptes créés par la plateforme ; l'inscription PME arrive en phase 4.
      disableSignUp: true,
      minPasswordLength: 12,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/two-factor/verify-totp": { window: 60, max: 5 },
        "/two-factor/verify-backup-code": { window: 60, max: 5 },
        "/sign-in/magic-link": { window: 60, max: 3 },
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 60, max: 5 },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session, ctx) => {
            const orgs = await organizationTypesOf(session.userId);
            const strict = orgs.some((o) => requiresTwoFactor(o.type));
            if (!isSessionCreationAllowed({ strictTwoFactor: strict, path: ctx?.path })) {
              throw new APIError("FORBIDDEN", {
                message: "Méthode de connexion non autorisée pour ce compte.",
              });
            }
            return { data: { ...session, activeOrganizationId: orgs[0]?.id ?? null } };
          },
          after: async (session, ctx) => {
            await audit(
              session.userId,
              {
                action: "auth.sign_in",
                entityType: "user",
                entityId: session.userId,
                metadata: { method: signInMethodOf(ctx?.path) },
              },
              {
                ip: session.ipAddress ?? null,
                userAgent: session.userAgent ?? null,
                organizationId:
                  (session as { activeOrganizationId?: string | null }).activeOrganizationId ??
                  null,
              },
            );
          },
        },
      },
      user: {
        update: {
          after: async (user, ctx) => {
            if (ctx?.path === "/two-factor/verify-totp" && user.twoFactorEnabled === true) {
              await audit(user.id, {
                action: "auth.two_factor_enabled",
                entityType: "user",
                entityId: user.id,
              });
            }
            if (ctx?.path === "/two-factor/disable" && user.twoFactorEnabled === false) {
              await audit(user.id, {
                action: "auth.two_factor_disabled",
                entityType: "user",
                entityId: user.id,
              });
            }
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-out" && ctx.path !== "/two-factor/disable") return;
        const current = await getSessionFromCtx(ctx);
        if (!current) return;
        if (ctx.path === "/two-factor/disable") {
          if (!isTwoFactorDisableAllowed(await isStrictTwoFactor(current.user.id))) {
            throw new APIError("FORBIDDEN", {
              message: "La double authentification est obligatoire pour ce compte.",
            });
          }
          return;
        }
        await audit(current.user.id, {
          action: "auth.sign_out",
          entityType: "user",
          entityId: current.user.id,
        });
      }),
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: false,
        schema: {
          organization: {
            additionalFields: {
              type: { type: "string", required: true, input: false },
            },
          },
        },
      }),
      twoFactor({ issuer: brand.name }),
      magicLink({
        disableSignUp: true,
        expiresIn: 60 * 10,
        sendMagicLink: async ({ email, url }) => {
          const user = await passwordlessRecipient(email);
          if (!user) return;
          const t = await emailTranslator(email);
          await mailer.send({
            to: user.email,
            subject: t("magicLinkSubject", { brand: brand.name }),
            text: t("magicLinkBody", { url }),
          });
        },
      }),
      emailOTP({
        // Phase 4 : le code par courriel ouvre aussi l'inscription des PME
        // (compte créé à la première vérification, puis onboarding).
        disableSignUp: false,
        otpLength: 6,
        expiresIn: 60 * 10,
        allowedAttempts: 5,
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== "sign-in") return;
          const existing = await userByEmail(email);
          if (existing && !(await passwordlessRecipient(email))) return;
          const t = await emailTranslator(email);
          await mailer.send({
            to: email.toLowerCase(),
            subject: t("otpSubject", { brand: brand.name }),
            text: t("otpBody", { otp }),
          });
        },
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth["$Infer"]["Session"];

let instance: Auth | undefined;

/** Instance paresseuse : les variables d'environnement ne sont lues qu'à l'exécution. */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
