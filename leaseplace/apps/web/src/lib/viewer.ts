import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { recordAudit, schema, withActor } from "@leaseplace/db";
import {
  canAccessSpace,
  homeSpaceOf,
  isOrganizationType,
  isRole,
  requiresTwoFactor,
  SPACE_PATHS,
  type OrganizationType,
  type Role,
  type Space,
} from "@leaseplace/domain";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getAuth } from "./auth";
import { appDb } from "./db";
import { requestContext } from "./request";

export interface Membership {
  organizationId: string;
  organizationName: string;
  organizationType: OrganizationType;
  role: Role;
}

export interface Viewer {
  user: { id: string; name: string; email: string; twoFactorEnabled: boolean };
  membership: Membership | null;
  memberships: Membership[];
}

/** Utilisateur connecté et son adhésion active, lues sous RLS (lp_app). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const current = await getAuth().api.getSession({ headers: await headers() });
  if (!current) return null;
  const { user, session } = current;
  const { memberships, organizations } = schema;
  const rows = await withActor(appDb(), { userId: user.id }, (tx) =>
    tx
      .select({
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationType: organizations.type,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(eq(memberships.userId, user.id))
      .orderBy(memberships.createdAt),
  );
  const valid = rows.flatMap((r): Membership[] =>
    isRole(r.role) && isOrganizationType(r.organizationType)
      ? [{ ...r, role: r.role, organizationType: r.organizationType }]
      : [],
  );
  const active =
    valid.find((m) => m.organizationId === session.activeOrganizationId) ?? valid[0] ?? null;
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled === true,
    },
    membership: active,
    memberships: valid,
  };
});

/** Chemin d'accueil du visiteur connecté (sans préfixe de langue). */
export function homePathOf(viewer: Viewer): string {
  // Compte sans organisation : PME en cours d'inscription.
  if (!viewer.membership) return "/bienvenue";
  if (requiresTwoFactor(viewer.membership.organizationType) && !viewer.user.twoFactorEnabled) {
    return "/securite/double-authentification";
  }
  const space = homeSpaceOf(viewer.membership.role);
  return space ? SPACE_PATHS[space] : "/acces-refuse";
}

export type SpaceViewer = Viewer & { membership: Membership };

/**
 * Garde d'un espace : connexion, 2FA obligatoire activée, permission
 * d'espace. Un refus est audité. La RLS reste la barrière des données.
 */
export async function requireSpace(space: Space, locale: Locale): Promise<SpaceViewer> {
  const viewer = await getViewer();
  if (!viewer) {
    return redirect({
      href: { pathname: "/connexion", query: { suite: SPACE_PATHS[space] } },
      locale,
    });
  }
  const { membership } = viewer;
  if (!membership) return redirect({ href: "/bienvenue", locale });
  if (requiresTwoFactor(membership.organizationType) && !viewer.user.twoFactorEnabled) {
    return redirect({ href: "/securite/double-authentification", locale });
  }
  if (!canAccessSpace(membership.role, space)) {
    const ctx = await requestContext();
    await withActor(
      appDb(),
      {
        userId: viewer.user.id,
        organizationId: membership.organizationId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      (tx) =>
        recordAudit(tx, {
          action: "space.access_denied",
          entityType: "space",
          entityId: space,
          metadata: { role: membership.role },
        }),
    );
    return redirect({ href: { pathname: "/acces-refuse", query: { espace: space } }, locale });
  }
  return { ...viewer, membership };
}

/** Acteur de transaction pour le visiteur (RLS + audit). */
export async function actorFor(viewer: SpaceViewer) {
  const ctx = await requestContext();
  return {
    userId: viewer.user.id,
    organizationId: viewer.membership.organizationId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  };
}
