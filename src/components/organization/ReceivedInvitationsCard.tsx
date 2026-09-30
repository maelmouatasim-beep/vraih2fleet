/** D6 — Invitations reçues par l'utilisateur courant (Accueil et Organisation). */
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { acceptInvitation, listMyInvitations } from "@/lib/supabase/organizations";
import { MailOpen } from "lucide-react";

export default function ReceivedInvitationsCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { changerOrganisation } = useOrganization();
  const queryClient = useQueryClient();
  const { data: invitations = [] } = useQuery({
    queryKey: ["my-organization-invitations", user?.email],
    queryFn: () => listMyInvitations(user!.email!),
    enabled: !!user?.email,
  });

  if (invitations.length === 0) return null;

  const accepter = async (id: string) => {
    try {
      const orgId = await acceptInvitation(id);
      await queryClient.invalidateQueries();
      await changerOrganisation.mutateAsync(orgId);
      toast({ title: t("organization.team.accepted") });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="py-4 space-y-2">
        {invitations.map((inv) => (
          <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <MailOpen className="w-4 h-4 text-primary" />
              {t("organization.team.received", {
                org: inv.organizationName ?? "—",
                role: t(`organization.roles.${inv.role}`),
              })}
            </span>
            <Button size="sm" onClick={() => void accepter(inv.id)}>{t("organization.team.accept")}</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
