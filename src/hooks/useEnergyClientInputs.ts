/**
 * Données client de prix de l'énergie (couche 3, §3.3 v2.2) et options
 * du moteur pour le parcours projet : un seul endroit construit les
 * OptionsParametres (année, horizon, taux, organisme, surcharges
 * client), pour que Faisabilité, Stratégies, Plan, Financement,
 * Rapports et Suivi calculent tous avec LES MÊMES entrées.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/hooks/useOrganization";
import {
  fusionnerSurcharges,
  getEnergyInputs,
  upsertEnergyInputs,
  type EnergyClientInputs,
} from "@/lib/supabase/energyInputs";
import type { OptionsParametres } from "@/lib/tco";
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

  const options = useMemo((): OptionsParametres | null => {
    if (!project || !organization) return null;
    return {
      anneeReference: new Date().getFullYear(),
      horizonAns: project.defaultAnalysisHorizonYears,
      // defaultDiscountRate est stocké en pour cent (5 = 5 %)
      tauxActualisationNominal: project.defaultDiscountRate / 100,
      typeOrganisme: organization.orgType,
      surchargesEnergie: {
        dieselParL: surcharges.dieselParL,
        electriciteEffectiveParKwh: surcharges.electriciteEffectiveParKwh,
        h2LivreParKg: surcharges.h2LivreParKg,
        devisRaccordement: surcharges.devisRaccordement,
      },
    };
  }, [project, organization, surcharges]);

  return {
    options,
    donneesClient: surcharges.provenances,
    isLoading: orgLoading || energieLoading,
    organization,
  };
}
