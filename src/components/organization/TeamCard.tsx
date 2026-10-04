/**
 * D6 — Équipe de l'organisation : membres (nom, courriel, rôle), gestion
 * des rôles et retrait par un admin (le dernier admin reste protégé par
 * la base), invitations par courriel avec rôle, révocation.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  changeMemberRole,
  inviteMember,
  listMembersDetail,
  listOrganizationInvitations,
  removeMember,
  revokeInvitation,
  type OrgRole,
  type OrganizationDTO,
} from "@/lib/supabase/organizations";
import { Loader2, Mail, Trash2, Users } from "lucide-react";

const ROLES: OrgRole[] = ["admin", "member", "reader"];
const selectCls =
  "flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60";

export default function TeamCard({ organization }: { organization: OrganizationDTO }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const estAdmin = organization.myRole === "admin";
  const [courriel, setCourriel] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [envoi, setEnvoi] = useState(false);
  const locale = i18n.language.startsWith("en") ? "en-CA" : "fr-CA";

  const { data: membres = [] } = useQuery({
    queryKey: ["organization-members-detail", organization.id],
    queryFn: () => listMembersDetail(organization.id),
  });
  const { data: invitations = [] } = useQuery({
    queryKey: ["organization-invitations", organization.id],
    queryFn: () => listOrganizationInvitations(organization.id),
    enabled: estAdmin,
  });

  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: ["organization-members-detail", organization.id] });
    void queryClient.invalidateQueries({ queryKey: ["organization-invitations", organization.id] });
  };

  const erreur = (e: unknown) =>
    toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });

  const inviter = async () => {
    if (!user || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(courriel.trim())) {
      toast({ title: t("organization.team.invalidEmail"), variant: "destructive" });
      return;
    }
    setEnvoi(true);
    try {
      await inviteMember(organization.id, courriel, role, user.id);
      toast({ title: t("organization.team.invited", { email: courriel.trim().toLowerCase() }) });
      setCourriel("");
      rafraichir();
    } catch (e) {
      erreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" /> {t("organization.members.title")}
        </CardTitle>
        <CardDescription>{t("organization.team.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("organization.members.member")}</TableHead>
              <TableHead>{t("organization.members.role")}</TableHead>
              <TableHead>{t("organization.members.since")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {membres.map((m) => (
              <TableRow key={m.memberId}>
                <TableCell>
                  <p className="font-medium">{m.fullName || m.email || t("organization.team.unknownMember")}</p>
                  {m.fullName && m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                  {m.userId === user?.id && <Badge variant="outline" className="mt-1">{t("organization.team.you")}</Badge>}
                </TableCell>
                <TableCell>
                  {estAdmin ? (
                    <select
                      className={selectCls}
                      aria-label={t("organization.members.role")}
                      value={m.role}
                      onChange={(e) =>
                        void changeMemberRole(m.memberId, e.target.value as OrgRole).then(rafraichir, erreur)
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{t(`organization.roles.${r}`)}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge variant={m.role === "admin" ? "default" : "secondary"}>{t(`organization.roles.${m.role}`)}</Badge>
                  )}
                </TableCell>
                <TableCell>{new Date(m.createdAt).toLocaleDateString(locale)}</TableCell>
                <TableCell>
                  {(estAdmin || m.userId === user?.id) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={m.userId === user?.id ? t("organization.team.leave") : t("organization.team.remove")}
                      onClick={() => {
                        const message =
                          m.userId === user?.id ? t("organization.team.confirmLeave") : t("organization.team.confirmRemove");
                        if (window.confirm(message)) void removeMember(m.memberId).then(rafraichir, erreur);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {estAdmin && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="font-medium text-sm flex items-center gap-2">
              <Mail className="w-4 h-4" /> {t("organization.team.inviteTitle")}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1 flex-1 min-w-[220px]">
                <Label htmlFor="team-email" className="text-xs">{t("organization.team.email")}</Label>
                <Input id="team-email" type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="team-role" className="text-xs">{t("organization.members.role")}</Label>
                <select id="team-role" className={selectCls} value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{t(`organization.roles.${r}`)}</option>
                  ))}
                </select>
              </div>
              <Button onClick={() => void inviter()} disabled={envoi || !courriel.trim()}>
                {envoi ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("organization.team.invite")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("organization.team.howItWorks")}</p>
            {invitations.length > 0 && (
              <ul className="text-sm divide-y divide-border rounded-md border border-border">
                {invitations.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {inv.email} · {t(`organization.roles.${inv.role}`)}{" "}
                      <span className="text-xs text-muted-foreground">
                        {t("organization.team.expires", { date: new Date(inv.expiresAt).toLocaleDateString(locale) })}
                      </span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => void revokeInvitation(inv.id).then(rafraichir, erreur)}>
                      {t("organization.team.revoke")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
