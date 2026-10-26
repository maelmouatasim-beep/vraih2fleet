import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
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

/** Accès support en cours : l'agent voit l'espace du compte cible, en lecture seule. */
export interface Impersonation {
  id: string;
  actorUserId: string;
  actorName: string;
  expiresAt: Date;
}

export interface Viewer {
  user: { id: string; name: string; email: string; twoFactorEnabled: boolean };
  membership: Membership | null;
  memberships: Membership[];
  impersonation: Impersonation | null;
}

async function membershipsOf(userId: string): Promise<Membership[]> {
  const { memberships, organizations } = schema;
  const rows = await withActor(appDb(), { userId }, (tx) =>
    tx
      .select({
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationType: organizations.type,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(eq(memberships.userId, userId))
      .orderBy(memberships.createdAt),
  );
  return rows.flatMap((r): Membership[] =>
    isRole(r.role) && isOrganizationType(r.organizationType)
      ? [{ ...r, role: r.role, organizationType: r.organizationType }]
      : [],
  );
}

/**
 * Accès support ouvert sur cette session : le compte cible et son adhésion
 * dans l'organisation visée. Lu par l'agent lui-même (RLS).
 */
async function supportAccessOf(actorId: string, sessionId: string) {
  const { impersonations, users } = schema;
  return withActor(appDb(), { userId: actorId }, async (tx) => {
    const [row] = await tx
      .select()
      .from(impersonations)
      .where(
        and(
          eq(impersonations.actorSessionId, sessionId),
          isNull(impersonations.endedAt),
          gt(impersonations.expiresAt, new Date()),
        ),
      );
    if (!row) return null;
    const [actor] = await tx.select({ name: users.name }).from(users).where(eq(users.id, actorId));
    const [target] = await tx.select().from(users).where(eq(users.id, row.targetUserId));
    return target ? { row, actorName: actor?.name ?? "", target } : null;
  });
}

/** Utilisateur connecté et son adhésion active, lues sous RLS (lp_app). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const current = await getAuth().api.getSession({ headers: await headers() });
  if (!current) return null;
  const { user, session } = current;
  const valid = await membershipsOf(user.id);
  // Seul un membre de la plateforme peut avoir un accès support ouvert.
  if (valid.some((m) => m.organizationType === "platform")) {
    const access = await supportAccessOf(user.id, session.id);
    if (access) {
      const targetMemberships = await membershipsOf(access.target.id);
      return {
        user: {
          id: access.target.id,
          name: access.target.name,
          email: access.target.email,
          twoFactorEnabled: access.target.twoFactorEnabled,
        },
        membership:
          targetMemberships.find((m) => m.organizationId === access.row.targetOrganizationId) ??
          null,
        memberships: targetMemberships.filter(
          (m) => m.organizationId === access.row.targetOrganizationId,
        ),
        impersonation: {
          id: access.row.id,
          actorUserId: user.id,
          actorName: access.actorName,
          expiresAt: access.row.expiresAt,
        },
      };
    }
  }
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
    impersonation: null,
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
  if (
    requiresTwoFactor(membership.organizationType) &&
    !viewer.user.twoFactorEnabled &&
    !viewer.impersonation
  ) {
    return redirect({ href: "/securite/double-authentification", locale });
  }
  if (!canAccessSpace(membership.role, space)) {
    // Accès support (lecture seule) : pas d'écriture au journal, simple refus.
    if (viewer.impersonation)
      return redirect({ href: { pathname: "/acces-refuse", query: { espace: space } }, locale });
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

/**
 * Acteur de transaction pour le visiteur (RLS + audit). Pendant un accès
 * support, l'agent est l'« impersonateur » : la transaction est en lecture
 * seule (packages/db, withActor).
 */
export async function actorFor(viewer: SpaceViewer) {
  const ctx = await requestContext();
  return {
    userId: viewer.user.id,
    organizationId: viewer.membership.organizationId,
    impersonatorId: viewer.impersonation?.actorUserId ?? null,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  };
}

/** Vrai pendant un accès support : aucune écriture, aucun téléchargement de pièce. */
export function isSupportAccess(viewer: Viewer): boolean {
  return viewer.impersonation !== null;
}
