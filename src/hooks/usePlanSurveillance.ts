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
import { construireStrategie } from "@/lib/journey/strategies";
import { vehiculeProjetDepuis } from "@/lib/journey/vehiculeProjet";
import { santeDuPlan, surveillerPlan, type AlertePlan, type PrixEnergie } from "@/lib/journey/surveillance";
import { texteAlerte } from "@/components/journey/surveillanceTexts";

export interface AlerteAffichee extends AlertePlan {
  ligne: LigneAlertePlan | null;
  vue: boolean;
}

/** Prix utilisés au dernier rapport (snapshot : parameters.parametres.prixAnnee0). */
export function prixDuSnapshot(parameters: unknown): PrixEnergie | null {
  const p = (parameters as { parametres?: { prixAnnee0?: Partial<PrixEnergie> } } | null)?.parametres?.prixAnnee0;
  if (!p || typeof p.dieselParL !== "number" || typeof p.electriciteEffectiveParKwh !== "number" || typeof p.h2LivreParKg !== "number") {
    return null;
  }
  return { dieselParL: p.dieselParL, electriciteEffectiveParKwh: p.electriciteEffectiveParKwh, h2LivreParKg: p.h2LivreParKg };
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
    const vehicules = projectVehicles.map((pv) => vehiculeProjetDepuis(pv, confirmeesParVehicule.get(pv.vehicle_id)));
    if (vehicules.length === 0) return [];
    const strategie = construireStrategie(vehicules, "plan_actuel", options);
    return surveillerPlan({
      aujourdHui: new Date().toISOString().slice(0, 10),
      strategie,
      vehicules: projectVehicles.map((pv) => ({
        id: pv.vehicle_id,
        unite: pv.vehicles.unit_number,
        anneeRemplacement: pv.replacement_year,
        realise: !!pv.completed_date,
      })),
      dernierRapport: snapshot
        ? {
            id: snapshot.id,
            date: snapshot.created_at,
            prix: prixDuSnapshot(snapshot.parameters),
            van: snapshot.van,
            empreinte: snapshot.fingerprint,
            parametres: (snapshot.parameters as { parametres?: unknown } | null)?.parametres,
          }
        : null,
      evenements: evenements.map((e) => ({
        id: e.id,
        programId: e.program_id,
        resumeFr: e.summary_fr,
        resumeEn: e.summary_en,
        valideLe: e.validated_at,
      })),
      demandes: applications.map((a) => ({ programId: a.program_id, statut: a.status })),
    });
  }, [project, options, isLoading, snapshotLoading, projectVehicles, confirmeesParVehicule, snapshot, evenements, applications]);

  // Synchronisation de l'état (éditeurs seulement ; un lecteur voit les
  // alertes calculées, sans état enregistré).
  const [peutModifier, setPeutModifier] = useState<boolean | null>(null);
  const derniereSignature = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId || !alertes) return;
    const fr = i18n.getFixedT("fr");
    const en = i18n.getFixedT("en");
    const charge = alertes.map((a) => {
      const tFr = texteAlerte(a, fr, "fr");
      const tEn = texteAlerte(a, en, "en");
      return {
        alert_key: a.cle,
        kind: a.type,
        severity: a.gravite,
        title_fr: tFr.titre.slice(0, 300),
        title_en: tEn.titre.slice(0, 300),
        message_fr: tFr.message.slice(0, 1500),
        message_en: tEn.message.slice(0, 1500),
      };
    });
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
