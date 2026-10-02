/**
 * Copilote de projet (Phase 5.2) : données du projet (snapshot), boucle
 * d'outils avec la fonction Edge `copilot` (les outils s'exécutent ICI,
 * avec le moteur TCO), historique d'équipe et application CONFIRMÉE des
 * propositions (journalisée).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useOptionsProjet } from "@/hooks/useEnergyClientInputs";
import { useConfirmedSubsidies } from "@/hooks/useConfirmedSubsidies";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import { lireAssignation, lireContraintes } from "@/lib/journey/optimizer";
import type { VehiculeProjet } from "@/lib/journey/strategies";
import { changementsVehicules } from "@/lib/journey/changeLog";
import {
  contexteCopilote,
  executerOutil,
  type PropositionCopilote,
  type SnapshotProjet,
} from "@/lib/copilot/outils";
import {
  appelerFonctionIa,
  ErreurIa,
  lireReglagesIa,
  listerMessagesCopilote,
  type CodeErreurIa,
} from "@/lib/supabase/ai";
import { journaliser } from "@/lib/supabase/changeLog";
import { saveOptimizerConstraints, setOptimizedStrategy, type ProjectDTO } from "@/lib/supabase/projects";

type Bloc = Record<string, unknown>;
type MessageTour = { role: "user" | "assistant"; content: Bloc[] };

type SortieCopilote =
  | { type: "outils"; tour: MessageTour[]; appels: { id: string; name: string; input: unknown }[]; tentatives: number }
  | { type: "reponse"; texte: string; nombresVerifies: number; sources: string[]; proposition: { id?: string } | null; messageId: string | null }
  | { type: "non_verifie"; nonVerifies: string[] }
  | { type: "refus" };

export type EtatCopilote =
  | { etat: "pret" }
  | { etat: "en_cours"; outils: string[] }
  | { etat: "erreur"; code: CodeErreurIa | "non_verifie" | "refus" | "trop_d_etapes" };

const MAX_ETAPES = 10;

export function useCopilot(projectId: string, project: ProjectDTO | null | undefined) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { options } = useOptionsProjet(project, projectId);
  const { projectVehicles, modifier } = useProjectVehicles(projectId);
  const { confirmeesParVehicule } = useConfirmedSubsidies(projectId);
  const organizationId = project?.organizationId ?? null;
  const [etat, setEtat] = useState<EtatCopilote>({ etat: "pret" });
  const [propositionsActives, setPropositionsActives] = useState<Record<string, PropositionCopilote>>({});
  const propositions = useRef(new Map<string, PropositionCopilote>());

  const { data: reglages, isLoading: reglagesLoading } = useQuery({
    queryKey: ["ai-settings", organizationId],
    queryFn: () => lireReglagesIa(organizationId!),
    enabled: !!organizationId,
  });
  const { data: historique = [] } = useQuery({
    queryKey: ["copilot-messages", projectId],
    queryFn: () => listerMessagesCopilote(projectId),
  });
  const { data: taches = [] } = useQuery({
    queryKey: ["copilot-tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("title, status, due_date, plan_year, auto_key")
        .eq("project_id", projectId)
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const snapshot = useMemo((): SnapshotProjet | null => {
    if (!options || !project) return null;
    const vehicules: VehiculeProjet[] = projectVehicles.map((pv) => ({
      ...pv.vehicles,
      replacement_year: pv.replacement_year,
      target_technology: pv.target_technology,
      subventionsConfirmees: confirmeesParVehicule.get(pv.vehicle_id),
    }));
    return {
      projet: {
        id: project.id,
        nom: project.name,
        horizonAns: options.horizonAns,
        anneeReference: options.anneeReference,
        tauxActualisation: options.tauxActualisationNominal,
      },
      strategieRetenue: project.selectedStrategy,
      vehicules,
      options,
      contraintes: lireContraintes(project.optimizerConstraints),
      assignation: lireAssignation(project.optimizedAssignment),
      // Minimisation : seul le titre des tâches GÉNÉRÉES par le plan est
      // transmis (une tâche saisie à la main peut nommer une personne).
      taches: taches.map((x) => ({
        titre: x.auto_key ? x.title : "(tâche saisie)",
        statut: x.status,
        echeance: x.due_date,
        annee: x.plan_year,
      })),
      aujourdhui: new Date().toISOString().slice(0, 10),
    };
  }, [options, project, projectVehicles, confirmeesParVehicule, taches]);

  const poser = useCallback(
    async (question: string) => {
      if (!snapshot || !organizationId) return;
      const langue = i18n.language === "en" ? "en" : "fr";
      // Contexte FIGÉ pour tout le tour (prompt système identique à chaque appel).
      const contexte = contexteCopilote(snapshot);
      const precedents = historique.slice(-8).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      let tour: MessageTour[] = [];
      let tentatives = 0;
      const outilsVus: string[] = [];
      setEtat({ etat: "en_cours", outils: [] });
      try {
        for (let etape = 0; etape < MAX_ETAPES; etape++) {
          const sortie = await appelerFonctionIa<SortieCopilote>("copilot", {
            organizationId,
            projectId,
            langue,
            question,
            contexte,
            precedents,
            tour,
            tentatives,
          });
          if (sortie.type === "outils") {
            tour = sortie.tour;
            tentatives = sortie.tentatives;
            const resultats = sortie.appels.map((a) => {
              outilsVus.push(a.name);
              const r = executerOutil(a.name, a.input, snapshot, propositions.current);
              return { type: "tool_result", tool_use_id: a.id, content: r.contenu, ...(r.erreur ? { is_error: true } : {}) };
            });
            tour = [...tour, { role: "user", content: resultats }];
            setEtat({ etat: "en_cours", outils: [...outilsVus] });
            continue;
          }
          if (sortie.type === "reponse") {
            const id = sortie.proposition?.id;
            const p = id ? propositions.current.get(id) : undefined;
            if (p && sortie.messageId) setPropositionsActives((x) => ({ ...x, [sortie.messageId!]: p }));
            await queryClient.invalidateQueries({ queryKey: ["copilot-messages", projectId] });
            setEtat({ etat: "pret" });
            return;
          }
          setEtat({ etat: "erreur", code: sortie.type === "non_verifie" ? "non_verifie" : "refus" });
          return;
        }
        setEtat({ etat: "erreur", code: "trop_d_etapes" });
      } catch (e) {
        setEtat({ etat: "erreur", code: e instanceof ErreurIa ? e.code : "erreur_service" });
      }
    },
    [snapshot, organizationId, projectId, historique, i18n.language, queryClient],
  );

  /** Applique une proposition APRÈS confirmation de l'utilisateur, et la journalise. */
  const appliquer = useCallback(
    async (p: PropositionCopilote) => {
      const parVehicule = new Map(projectVehicles.map((pv) => [pv.vehicle_id, pv]));
      for (const c of p.changements) {
        const pv = parVehicule.get(c.vehiculeId);
        if (!pv) continue;
        await modifier.mutateAsync({
          id: pv.id,
          patch: { replacement_year: c.anneeApres, target_technology: c.cibleApres },
        });
      }
      if (p.type === "optimisee" && p.optimisee) {
        await saveOptimizerConstraints(projectId, p.optimisee.contraintes as unknown as Json);
        await setOptimizedStrategy(projectId, { calculeLe: new Date().toISOString(), vehicules: p.optimisee.choix } as unknown as Json);
      }
      if (organizationId) {
        await journaliser({
          organizationId,
          projectId,
          source: "copilote",
          action: `copilote:${p.type}`,
          resume: t(`copilot.kinds.${p.type}`, { count: p.changements.length }),
          changements: changementsVehicules(
            p.changements.map((c) => ({
              unite: c.unite,
              anneeAvant: c.anneeAvant,
              anneeApres: c.anneeApres,
              cibleAvant: c.cibleAvant,
              cibleApres: c.cibleApres,
            })),
          ),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["change-log", projectId] });
      setPropositionsActives((x) => Object.fromEntries(Object.entries(x).filter(([, v]) => v.id !== p.id)));
    },
    [projectVehicles, modifier, projectId, organizationId, queryClient, t],
  );

  return {
    actif: reglages?.copilot_enabled === true,
    reglagesLoading,
    pret: !!snapshot,
    historique,
    etat,
    poser,
    appliquer,
    propositionsActives,
    reinitialiserErreur: () => setEtat({ etat: "pret" }),
  };
}
