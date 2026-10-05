/**
 * Recalcul PLANIFIÉ des alertes du plan, côté serveur — exécuté en Node
 * (jamais dans le bundle du navigateur) par scripts/alertes/recalcul-alertes.mjs,
 * chaque nuit (.github/workflows/recalcul-alertes.yml) et en CI.
 *
 * Mêmes lectures que l'écran (fonctions de src/lib/fleet et src/lib/supabase,
 * avec un client service_role fourni par le lanceur) et MÊME calcul
 * (surveillanceProjet.ts) : les alertes entrent dans la cloche même si
 * personne n'ouvre le projet. Écriture par sync_plan_alerts_serveur
 * (service_role seulement).
 */
import i18next, { type TFunction } from "i18next";
import fr from "@/i18n/locales/fr/translation.json";
import en from "@/i18n/locales/en/translation.json";
import { normalizeTranslations, type TranslationDict } from "@/i18n/normalize";
import { supabase } from "@/integrations/supabase/client";
import { fusionnerSurcharges } from "@/lib/energyClient";
import { parVehicule } from "@/lib/confirmedSubsidies";
import { listProjectVehicles } from "@/lib/fleet/projectVehicles";
import { listGarages } from "@/lib/fleet/garages";
import { getEnergyInputs } from "@/lib/supabase/energyInputs";
import { listConfirmedSubsidies } from "@/lib/supabase/confirmedSubsidies";
import { listSubsidyApplications } from "@/lib/supabase/subsidyApplications";
import { dernierSnapshotRapport } from "@/lib/supabase/reportSnapshots";
import { listerEvenementsProgrammes } from "@/lib/supabase/subsidyWatch";
import { alertesDuProjet, chargeSynchronisation, optionsProjet, typeOrganismeValide } from "./surveillanceProjet";

export interface ResultatProjet {
  projet: string;
  alertes: number;
  nouvelles: number;
  resolues: number;
  erreur?: string;
}

export interface ResultatRecalcul {
  date: string;
  projets: ResultatProjet[];
  erreurs: number;
}

function traducteurs(): { fr: TFunction; en: TFunction } {
  const i = i18next.createInstance();
  void i.init({
    resources: {
      fr: { translation: normalizeTranslations(fr as unknown as TranslationDict) },
      en: { translation: normalizeTranslations(en as unknown as TranslationDict) },
    },
    lng: "fr",
    fallbackLng: "fr",
    interpolation: { escapeValue: false },
    initImmediate: false,
  });
  return { fr: i.getFixedT("fr"), en: i.getFixedT("en") };
}

export async function recalculerAlertes(options: { aujourdHui?: string; projets?: string[] } = {}): Promise<ResultatRecalcul> {
  const aujourdHui = options.aujourdHui ?? new Date().toISOString().slice(0, 10);
  const t = traducteurs();
  let requete = supabase
    .from("projects")
    .select("id, organization_id, default_analysis_horizon_years, default_discount_rate, organizations(org_type)")
    .not("organization_id", "is", null);
  if (options.projets?.length) requete = requete.in("id", options.projets);
  const { data: projets, error } = await requete;
  if (error) throw error;
  const evenements = await listerEvenementsProgrammes();

  const resultats: ResultatProjet[] = [];
  for (const p of projets ?? []) {
    try {
      const projectVehicles = await listProjectVehicles(p.id);
      if (projectVehicles.length === 0) continue;
      const orgId = p.organization_id as string;
      const [entrees, garages, confirmees, demandes, snapshot] = await Promise.all([
        getEnergyInputs(orgId, p.id),
        listGarages(orgId),
        listConfirmedSubsidies(p.id),
        listSubsidyApplications(p.id),
        dernierSnapshotRapport(p.id),
      ]);
      const org = (p as unknown as { organizations: { org_type: string } | null }).organizations;
      const opts = optionsProjet({
        anneeReference: Number(aujourdHui.slice(0, 4)),
        horizonAns: p.default_analysis_horizon_years,
        tauxActualisationStocke: Number(p.default_discount_rate),
        typeOrganisme: typeOrganismeValide(org?.org_type) ?? "municipalite",
        surcharges: fusionnerSurcharges(entrees.organisation, entrees.projet),
        garages,
      });
      const alertes = alertesDuProjet({
        aujourdHui,
        options: opts,
        projectVehicles,
        confirmeesParVehicule: parVehicule(confirmees),
        snapshot,
        evenements,
        demandes,
      });
      const charge = chargeSynchronisation(alertes, t.fr, t.en);

      const { data: actives, error: eActives } = await supabase
        .from("plan_alerts")
        .select("alert_key")
        .eq("project_id", p.id)
        .is("resolved_at", null);
      if (eActives) throw eActives;
      const avant = new Set((actives ?? []).map((a) => a.alert_key));
      const apres = new Set(charge.map((c) => c.alert_key));

      const { error: eSync } = await supabase.rpc("sync_plan_alerts_serveur" as never, { _project: p.id, _alerts: charge } as never);
      if (eSync) throw eSync;
      resultats.push({
        projet: p.id,
        alertes: charge.length,
        nouvelles: [...apres].filter((k) => !avant.has(k)).length,
        resolues: [...avant].filter((k) => !apres.has(k)).length,
      });
    } catch (e) {
      resultats.push({ projet: p.id, alertes: 0, nouvelles: 0, resolues: 0, erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return { date: aujourdHui, projets: resultats, erreurs: resultats.filter((r) => r.erreur).length };
}
