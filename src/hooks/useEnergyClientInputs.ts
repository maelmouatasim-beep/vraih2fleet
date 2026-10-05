/**
 * Données client de prix de l'énergie (couche 3, §3.3 v2.2) et options
 * du moteur pour le parcours projet : un seul endroit construit les
 * OptionsParametres (année, horizon, taux, organisme, surcharges
 * client), pour que Faisabilité, Stratégies, Plan, Financement,
 * Rapports et Suivi calculent tous avec LES MÊMES entrées.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import {
  fusionnerSurcharges,
  getEnergyInputs,
  upsertEnergyInputs,
  type EnergyClientInputs,
} from "@/lib/supabase/energyInputs";
import type { OptionsStrategie } from "@/lib/journey/strategies";
import { useGarages } from "@/hooks/useGarages";
import { optionsProjet, typeOrganismeValide } from "@/lib/journey/surveillanceProjet";
import type { ProjectDTO } from "@/lib/supabase/projects";

export function useEnergyClientInputs(projectId?: string) {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["energy-client-inputs", organization?.id, projectId ?? null],
    queryFn: () => getEnergyInputs(organization!.id, projectId),
    enabled: !!organization?.id,
    staleTime: 60 * 1000,
  });

  const enregistrer = useMutation({
    mutationFn: (valeurs: Partial<EnergyClientInputs> & { project_id?: string | null }) =>
      upsertEnergyInputs({ ...valeurs, organization_id: organization!.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["energy-client-inputs"] }),
  });

  const surcharges = useMemo(
    () => fusionnerSurcharges(query.data?.organisation ?? null, query.data?.projet ?? null),
    [query.data],
  );

  return {
    organisation: query.data?.organisation ?? null,
    projet: query.data?.projet ?? null,
    surcharges,
    enregistrer,
    isLoading: query.isLoading,
  };
}

/** Options du moteur pour un projet du parcours : mêmes entrées pour
 *  toutes les étapes, données client incluses. Retourne aussi les
 *  libellés « donnée client » pour les rapports. */
export function useOptionsProjet(project: ProjectDTO | null | undefined, projectId?: string) {
  const { organization, isLoading: orgLoading } = useOrganization();
  const { surcharges, isLoading: energieLoading } = useEnergyClientInputs(projectId);

  // Revue B5 : le parcours calcule avec le type d'organisme du PROJET
  // (son organisation), pas celui de l'utilisateur courant — un
  // collaborateur externe d'une entreprise ne doit pas transformer une
  // municipalité en entreprise dans les taxes.
  const typeProjet = useQuery({
    queryKey: ["project-org-type", project?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_project_org_type", { _project: project!.id });
      if (error) throw error;
      return data;
    },
    enabled: !!project?.id && !!project?.organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Garages de l'organisation du PROJET : puissance disponible, devis de
  // raccordement et fenêtre de recharge (bloc 2.1).
  const { garages, isLoading: garagesLoading } = useGarages(project?.organizationId ?? organization?.id);

  const options = useMemo((): OptionsStrategie | null => {
    if (!project || !organization) return null;
    if (project.organizationId && typeProjet.isLoading) return null;
    // Même assemblage que le recalcul planifié côté serveur (surveillanceProjet.ts).
    return optionsProjet({
      anneeReference: new Date().getFullYear(),
      horizonAns: project.defaultAnalysisHorizonYears,
      tauxActualisationStocke: project.defaultDiscountRate,
      typeOrganisme: typeOrganismeValide(typeProjet.data) ?? organization.orgType,
      surcharges,
      garages,
    });
  }, [project, organization, surcharges, typeProjet.data, typeProjet.isLoading, garages]);

  return {
    options,
    donneesClient: surcharges.provenances,
    isLoading:
      orgLoading || energieLoading || garagesLoading || (!!project?.organizationId && typeProjet.isLoading),
    organization,
  };
}
