/**
 * Phase 5 — Historique des modifications du plan (journal immuable) :
 * qui, quand, quoi, avec l'aperçu avant → après. Visible par l'équipe.
 */
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listerJournalFlotte, listerJournalProjet } from "@/lib/supabase/changeLog";
import { listMembersDetail } from "@/lib/supabase/organizations";
import type { ChangementJournal } from "@/lib/journey/changeLog";
import { History } from "lucide-react";

interface ChangeLogCardProps {
  /** Absent : journal de la flotte de l'organisation (imports). */
  projectId?: string;
  organizationId: string | null | undefined;
}

export default function ChangeLogCard({ projectId, organizationId }: ChangeLogCardProps) {
  const { t, i18n } = useTranslation();
  const portee = projectId ? "project" : "fleet";
  const { data: lignes = [] } = useQuery({
    queryKey: projectId ? ["change-log", projectId] : ["change-log-fleet", organizationId],
    queryFn: () => (projectId ? listerJournalProjet(projectId) : listerJournalFlotte(organizationId!)),
    enabled: !!projectId || !!organizationId,
  });
  const { data: membres = [] } = useQuery({
    queryKey: ["org-members-detail", organizationId],
    queryFn: () => listMembersDetail(organizationId!),
    enabled: !!organizationId,
  });
  const nom = (userId: string) => {
    const m = membres.find((x) => x.userId === userId);
    return m?.fullName || m?.email || t("journey.changeLog.teamMember");
  };
  const valeur = (v: ChangementJournal["avant"]) => (v == null || v === "" ? "—" : String(v));
  const champ = (c: string) =>
    t(`journey.changeLog.fields.${c}`, { defaultValue: t(`smartImport.fields.${c}`, { defaultValue: c }) });
  const locale = i18n.language.startsWith("en") ? "en-CA" : "fr-CA";

  return (
    <Card data-testid={portee === "project" ? "change-log" : "fleet-change-log"}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          {portee === "project" ? t("journey.changeLog.title") : t("journey.changeLog.fleetTitle")}
        </CardTitle>
        <CardDescription>{portee === "project" ? t("journey.changeLog.subtitle") : t("journey.changeLog.fleetSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {lignes.length === 0 ? (
          <p className="text-muted-foreground">{t("journey.changeLog.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {lignes.map((l) => {
              const changements = ((l.details as { changements?: ChangementJournal[] } | null)?.changements ?? []).slice(0, 6);
              const total = (l.details as { changements?: ChangementJournal[] } | null)?.changements?.length ?? 0;
              return (
                <li key={l.id} className="py-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{t(`journey.changeLog.sources.${l.source}`, { defaultValue: l.source })}</Badge>
                    <span className="font-medium">{l.summary ?? l.action}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("journey.changeLog.byOn", {
                      who: nom(l.user_id),
                      when: new Date(l.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }),
                    })}
                  </p>
                  {changements.length > 0 && (
                    <ul className="text-xs text-muted-foreground pl-3">
                      {changements.map((c, i) => (
                        <li key={i}>
                          {c.cible} · {champ(c.champ)} : {valeur(c.avant)} → <span className="text-foreground">{valeur(c.apres)}</span>
                        </li>
                      ))}
                      {total > changements.length && <li>{t("journey.changeLog.more", { count: total - changements.length })}</li>}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
