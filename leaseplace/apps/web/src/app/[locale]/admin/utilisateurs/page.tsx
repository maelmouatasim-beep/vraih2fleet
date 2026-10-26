import { asc, eq } from "drizzle-orm";
import { Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { schema } from "@leaseplace/db";
import { can } from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { TableScroll } from "@leaseplace/ui/table-scroll";
import { PageHeader } from "@/components/shell/shells";
import type { Locale } from "@/i18n/routing";
import { authDb } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireSpace } from "@/lib/viewer";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing.users" });
  return { title: t("title"), robots: { index: false } };
}

/**
 * Utilisateurs (lecture) : organisation, rôle, double authentification.
 * Lu par la connexion d'authentification (tables identity), réservé à
 * l'administration (user.manage).
 */
export default async function AdminUsers({ params }: Props) {
  const { locale } = await params;
  const viewer = await requireSpace("admin", locale as Locale);
  const t = await getTranslations("billing.users");
  const tr = await getTranslations("roles");
  if (!can(viewer.membership.role, "user.manage"))
    return (
      <EmptyState icon={<Users />} title={t("restrictedTitle")} description={t("restrictedBody")} />
    );
  const { users, memberships, organizations } = schema;
  const rows = await authDb()
    .select({
      id: memberships.id,
      name: users.name,
      email: users.email,
      twoFactor: users.twoFactorEnabled,
      createdAt: users.createdAt,
      role: memberships.role,
      organization: organizations.name,
      type: organizations.type,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .orderBy(asc(organizations.type), asc(organizations.name), asc(users.name))
    .limit(500);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader title={t("title")} description={t("description", { count: rows.length })} />
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <TableScroll label={t("title")}>
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
              <tr>
                {(["name", "email", "organization", "role", "twoFactor", "created"] as const).map(
                  (c) => (
                    <th key={c} scope="col" className="px-4 py-2.5 text-start font-medium">
                      {t(`columns.${c}`)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} data-user-row={r.email}>
                  <td className="px-4 py-2.5 font-medium text-fg">{r.name}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-fg-muted" dir="ltr">
                    {r.email}
                  </td>
                  <td className="px-4 py-2.5">{r.organization}</td>
                  <td className="px-4 py-2.5">{tr(r.role)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={r.twoFactor ? "success" : "neutral"}>
                      {r.twoFactor ? t("on") : t("off")}
                    </Badge>
                  </td>
                  <td className="tabular px-4 py-2.5">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </div>
      <p className="text-[12px] text-fg-subtle">{t("impersonationNote")}</p>
    </div>
  );
}
