/**
 * Phase 5.5 — Alerte du projet : changements VALIDÉS par l'équipe H2Fleet
 * (veille des subventions) pour les programmes que le plan utilise.
 */
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { listerEvenementsProgrammes } from "@/lib/supabase/subsidyWatch";
import { BellRing, ExternalLink } from "lucide-react";

export default function ProgramChangesAlert({ programmes }: { programmes: string[] }) {
  const { t, i18n } = useTranslation();
  const langue = i18n.language === "en" ? "en" : "fr";
  const cle = [...programmes].sort().join(",");
  const { data: evenements = [] } = useQuery({
    queryKey: ["subsidy-events", cle],
    queryFn: () => listerEvenementsProgrammes(programmes),
    enabled: programmes.length > 0,
  });
  if (evenements.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300/70 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2" data-testid="program-changes-alert">
      <p className="font-medium flex items-center gap-2">
        <BellRing className="w-4 h-4 text-amber-600" /> {t("journey.financing.programChanges", { count: evenements.length })}
      </p>
      <ul className="text-sm space-y-1">
        {evenements.map((e) => (
          <li key={e.id}>
            {/* Le résumé validé nomme déjà le programme. */}
            {langue === "en" ? e.summary_en : e.summary_fr}{" "}
            <span className="text-xs text-muted-foreground">({t("library.watch.validatedOn", { date: e.validated_at.slice(0, 10) })})</span>{" "}
            <a href={e.source_url} target="_blank" rel="noreferrer" className="text-xs underline inline-flex items-center gap-0.5">
              {t("library.watch.source")} <ExternalLink className="w-3 h-3" />
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("journey.financing.programChangesNote")}</p>
    </div>
  );
}
