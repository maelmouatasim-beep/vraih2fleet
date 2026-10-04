/**
 * Audit acheteur, point 11 — tant que l'organisation porte le nom créé par
 * défaut, l'étape Rapports demande son vrai nom (il figure en en-tête du
 * PDF, de la note au conseil et du classeur).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { updateOrganization } from "@/lib/supabase/organizations";

export default function OrgNamePrompt({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [nom, setNom] = useState("");
  const [enCours, setEnCours] = useState(false);

  const enregistrer = async () => {
    const valeur = nom.trim();
    if (!valeur) return;
    setEnCours(true);
    try {
      await updateOrganization(organizationId, { name: valeur });
      await queryClient.invalidateQueries({ queryKey: ["organization"] });
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({ title: t("journey.reports.orgName.saved") });
    } catch {
      toast({ title: t("common.error"), description: t("journey.reports.orgName.error"), variant: "destructive" });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm dark:bg-amber-950/30"
      data-testid="org-name-prompt"
      onSubmit={(e) => {
        e.preventDefault();
        void enregistrer();
      }}
    >
      <div className="flex min-w-0 gap-2">
        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{t("journey.reports.orgName.title")}</p>
          <p className="text-muted-foreground">{t("journey.reports.orgName.body")}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label={t("journey.reports.orgName.label")}
          placeholder={t("journey.reports.orgName.placeholder")}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          maxLength={120}
          className="sm:max-w-sm bg-background"
          data-testid="org-name-input"
        />
        <Button type="submit" size="sm" disabled={enCours || !nom.trim()} className="shrink-0">
          {t("journey.reports.orgName.save")}
        </Button>
      </div>
    </form>
  );
}
