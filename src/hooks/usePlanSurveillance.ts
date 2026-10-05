/**
 * Phase 5.6 — Surveillance d'un projet : alertes CALCULÉES par le module
 * pur src/lib/journey/surveillance.ts à partir des données courantes,
 * puis état synchronisé dans plan_alerts (première détection, « vue »,
 * résolution, courriel) quand l'utilisateur peut éditer le projet.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useOptionsProjet } from "@/hooks/useEnergyClientInputs";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import { useConfirmedSubsidies } from "@/hooks/useConfirmedSubsidies";
import { useSubsidyApplications } from "@/hooks/useSubsidyApplications";
import { dernierSnapshotRapport } from "@/lib/supabase/reportSnapshots";
import { listerEvenementsProgrammes } from "@/lib/supabase/subsidyWatch";
import { listerAlertesPlan, marquerAlerteVue, synchroniserAlertesPlan, type LigneAlertePlan } from "@/lib/supabase/planAlerts";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { santeDuPlan, type AlertePlan } from "@/lib/journey/surveillance";
import { alertesDuProjet, chargeSynchronisation } from "@/lib/journey/surveillanceProjet";

export { prixDuSnapshot } from "@/lib/journey/surveillanceProjet";

export interface AlerteAffichee extends AlertePlan {
  ligne: LigneAlertePlan | null;
  vue: boolean;
}

export function usePlanSurveillance(projectId: string | undefined, project: ProjectDTO | null | undefined) {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { options } = useOptionsProjet(project, projectId);
  const { projectVehicles, isLoading } = useProjectVehicles(projectId);
  const { confirmeesParVehicule } = useConfirmedSubsidies(projectId);
  const { applications } = useSubsidyApplications(projectId);
  const { data: snapshot, isLoading: snapshotLoading } = useQuery({
    queryKey: ["report-snapshot", projectId],
    queryFn: () => dernierSnapshotRapport(projectId!),
    enabled: !!projectId,
  });
  const { data: evenements = [] } = useQuery({ queryKey: ["subsidy-events"], queryFn: () => listerEvenementsProgrammes() });
  const { data: lignes = [] } = useQuery({
    queryKey: ["plan-alerts", projectId],
    queryFn: () => listerAlertesPlan(projectId!),
    enabled: !!projectId,
  });

  const alertes = useMemo<AlertePlan[] | null>(() => {
    if (!project || !options || isLoading || snapshotLoading) return null;
    // Même calcul que le recalcul planifié côté serveur (surveillanceProjet.ts).
    return alertesDuProjet({
      aujourdHui: new Date().toISOString().slice(0, 10),
      options,
      projectVehicles,
      confirmeesParVehicule,
      snapshot: snapshot ?? null,
      evenements,
      demandes: applications,
    });
  }, [project, options, isLoading, snapshotLoading, projectVehicles, confirmeesParVehicule, snapshot, evenements, applications]);

  // Synchronisation de l'état (éditeurs seulement ; un lecteur voit les
  // alertes calculées, sans état enregistré).
  const [peutModifier, setPeutModifier] = useState<boolean | null>(null);
  const derniereSignature = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId || !alertes) return;
    const charge = chargeSynchronisation(alertes, i18n.getFixedT("fr"), i18n.getFixedT("en"));
    const signature = JSON.stringify(charge);
    if (signature === derniereSignature.current) return;
    derniereSignature.current = signature;
    synchroniserAlertesPlan(projectId, charge)
      .then((ok) => {
        setPeutModifier(ok);
        if (ok) void queryClient.invalidateQueries({ queryKey: ["plan-alerts", projectId] });
      })
      .catch(() => {
        derniereSignature.current = null;
      });
  }, [projectId, alertes, i18n, queryClient]);

  const affichees = useMemo<AlerteAffichee[] | null>(() => {
    if (!alertes) return null;
    const parCle = new Map(lignes.map((l) => [l.alert_key, l]));
    return alertes.map((a) => {
      const ligne = parCle.get(a.cle) ?? null;
      return { ...a, ligne, vue: !!ligne?.dismissed_at };
    });
  }, [alertes, lignes]);

  const sante = useMemo(
    () => (alertes ? santeDuPlan(alertes, new Set((affichees ?? []).filter((a) => a.vue).map((a) => a.cle))) : null),
    [alertes, affichees],
  );

  const marquerVue = async (a: AlerteAffichee) => {
    if (!a.ligne || !projectId) return;
    await marquerAlerteVue(a.ligne.id);
    await queryClient.invalidateQueries({ queryKey: ["plan-alerts", projectId] });
  };

  return { alertes: affichees, sante, peutModifier: peutModifier === true, marquerVue };
}
