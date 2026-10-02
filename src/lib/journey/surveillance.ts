/**
 * Phase 5.6 — SURVEILLANCE DU PLAN. Module PUR et déterministe (aucune
 * IA) : compare l'état courant d'un projet à ce qui a été présenté au
 * dernier rapport et à ce qui l'entoure, et produit des alertes
 * explicables, chacune avec une CLÉ stable qui change dès que les données
 * changent (une alerte marquée « vue » réapparaît si la situation évolue).
 *
 *  - donnees_energie : un prix de l'énergie utilisé par le moteur a varié
 *    d'au moins 5 % depuis le dernier rapport → stress test relancé
 *    (« le diesel a baissé de 15 % : votre plan reste gagnant dans 2
 *    scénarios sur 3 ») ;
 *  - echeance_subvention : un programme retenu par le plan se termine dans
 *    moins de 180 jours et aucune demande n'est déposée ;
 *  - remplacement_retard : remplacements prévus avant l'année en cours,
 *    non marqués réalisés ;
 *  - programme_modifie : changement VALIDÉ par la veille (5.5) sur un
 *    programme examiné pour le plan, depuis le dernier rapport ;
 *  - capacite_garage : les bornes d'un garage demandent plus de kW que la
 *    puissance disponible.
 */
import { PROGRAMMES, analyserSensibilite, calculerPlan, empreinte, type ProgrammeSubvention } from "@/lib/tco";
import type { StrategieConstruite } from "./strategies";

export type GraviteAlerte = "critique" | "attention" | "info";
export type TypeAlerte =
  | "donnees_energie"
  | "echeance_subvention"
  | "remplacement_retard"
  | "programme_modifie"
  | "capacite_garage";
export type EtapeLien = "plan" | "financement" | "rapports" | "suivi";
export type Energie = "diesel" | "electricite" | "hydrogene";

export type DetailAlerte =
  | {
      type: "donnees_energie";
      dateRapport: string;
      variations: { energie: Energie; avant: number; apres: number; pct: number }[];
      gagnants: number;
      /** VAN centrale du plan COURANT avec les prix du rapport (effet du prix seul). */
      vanAnciensPrix: number;
      vanActuelle: number;
      vanPrudente: number;
      /** Le plan lui-même (véhicules, cibles, paramètres hors prix) a aussi
       *  changé depuis le rapport : la VAN présentée n'est pas comparable. */
      planModifie: boolean;
      vanRapport: number | null;
    }
  | { type: "echeance_subvention"; programmeId: string; dateFin: string; jours: number; montant: number; vehicules: number }
  | { type: "remplacement_retard"; vehicules: { id: string; unite: string; annee: number }[] }
  | { type: "programme_modifie"; evenementId: string; programmeId: string; resumeFr: string; resumeEn: string; valideLe: string }
  | {
      type: "capacite_garage";
      garage: string | null;
      kwDemandes: number;
      kwDisponibles: number;
      kwSupplementaires: number;
      presumee: boolean;
      cout: number;
      source: string;
    };

export interface AlertePlan {
  cle: string;
  type: TypeAlerte;
  gravite: GraviteAlerte;
  lien: EtapeLien;
  detail: DetailAlerte;
}

export interface PrixEnergie {
  dieselParL: number;
  electriciteEffectiveParKwh: number;
  h2LivreParKg: number;
}

export interface EntreeSurveillance {
  /** Date du jour, ISO (AAAA-MM-JJ). */
  aujourdHui: string;
  /** Plan courant (« plan_actuel » : cibles réelles), options courantes. */
  strategie: StrategieConstruite;
  vehicules: { id: string; unite: string; anneeRemplacement: number | null; realise: boolean }[];
  /** Dernier rapport produit (snapshot) : prix utilisés et VAN présentée. */
  dernierRapport: {
    id: string;
    date: string;
    prix: PrixEnergie | null;
    van: number | null;
    /** Empreinte des entrées et paramètres du rapport (snapshot). */
    empreinte?: string | null;
    parametres?: unknown;
  } | null;
  /** Changements de programmes VALIDÉS (veille 5.5). */
  evenements: { id: string; programId: string; resumeFr: string; resumeEn: string; valideLe: string }[];
  /** Demandes de subvention suivies (étape Financement). */
  demandes: { programId: string; statut: string }[];
  programmes?: ProgrammeSubvention[];
}

export const SEUILS_SURVEILLANCE = {
  /** Variation relative d'un prix de l'énergie qui déclenche l'alerte. */
  variationPrix: 0.05,
  /** Fenêtre d'échéance d'un programme retenu (jours). */
  echeanceJours: 180,
  echeanceCritiqueJours: 30,
  /** Sans rapport : changements de programmes des 90 derniers jours. */
  evenementsSansRapportJours: 90,
} as const;

const JOUR_MS = 86_400_000;
const joursEntre = (de: string, a: string) => Math.round((Date.parse(a.slice(0, 10)) - Date.parse(de.slice(0, 10))) / JOUR_MS);
const DEMANDE_DEPOSEE = new Set(["deposee", "accordee", "recue"]);

export function surveillerPlan(e: EntreeSurveillance): AlertePlan[] {
  const alertes: AlertePlan[] = [];
  const programmes = e.programmes ?? PROGRAMMES;
  const s = e.strategie;
  const anneeCourante = Number(e.aujourdHui.slice(0, 4));

  // 1. Données de l'énergie vs dernier rapport, stress test relancé
  if (e.dernierRapport?.prix && s.plan && s.resultat) {
    const avant = e.dernierRapport.prix;
    const apres = s.plan.parametres.prixAnnee0;
    const utilise = {
      diesel: true,
      electricite: s.plan.vehicules.some((v) => v.alternative.technologie === "BEV"),
      hydrogene: s.plan.vehicules.some((v) => v.alternative.technologie === "FCEV"),
    };
    const paires: [Energie, number, number][] = [
      ["diesel", avant.dieselParL, apres.dieselParL],
      ["electricite", avant.electriciteEffectiveParKwh, apres.electriciteEffectiveParKwh],
      ["hydrogene", avant.h2LivreParKg, apres.h2LivreParKg],
    ];
    const variations = paires
      .filter(([energie, a, b]) => utilise[energie] && a > 0 && Math.abs(b - a) / a >= SEUILS_SURVEILLANCE.variationPrix)
      .map(([energie, a, b]) => ({ energie, avant: a, apres: b, pct: Math.round(((b - a) / a) * 100) }));
    if (variations.length > 0) {
      const sens = analyserSensibilite(s.plan);
      const vans = [sens.scenarios.prudent.van, sens.scenarios.central.van, sens.scenarios.favorable.van];
      const gagnants = vans.filter((v) => v > 0).length;
      const vanActuelle = s.resultat.vanDifferentielle;
      // Effet du prix SEUL : même plan, prix du rapport.
      const vanAnciensPrix = calculerPlan({
        ...s.plan,
        parametres: {
          ...s.plan.parametres,
          prixAnnee0: {
            ...s.plan.parametres.prixAnnee0,
            dieselParL: avant.dieselParL,
            electriciteEffectiveParKwh: avant.electriciteEffectiveParKwh,
            h2LivreParKg: avant.h2LivreParKg,
          },
        },
      }).vanDifferentielle;
      const r = e.dernierRapport;
      const planModifie =
        !!r.empreinte && !!r.parametres ? empreinte({ ...s.plan, parametres: r.parametres }) !== r.empreinte : false;
      const gravite: GraviteAlerte =
        vanAnciensPrix > 0 && vanActuelle <= 0 ? "critique" : gagnants < 3 ? "attention" : "info";
      alertes.push({
        cle: `energie:${r.id}:${variations.map((v) => `${v.energie}${v.pct}`).join(",")}`,
        type: "donnees_energie",
        gravite,
        lien: "rapports",
        detail: {
          type: "donnees_energie",
          dateRapport: r.date.slice(0, 10),
          variations,
          gagnants,
          vanAnciensPrix,
          vanActuelle,
          vanPrudente: sens.scenarios.prudent.van,
          planModifie,
          vanRapport: r.van,
        },
      });
    }
  }

  // 2. Échéances des programmes retenus par le plan
  const retenus = new Map<string, { montant: number; vehicules: number }>();
  const examines = new Set<string>();
  for (const liste of Object.values(s.explicationsSubventions)) {
    for (const ex of liste) {
      examines.add(ex.programmeId);
      if (ex.montant > 0) {
        const r = retenus.get(ex.programmeId) ?? { montant: 0, vehicules: 0 };
        retenus.set(ex.programmeId, { montant: r.montant + ex.montant, vehicules: r.vehicules + 1 });
      }
    }
  }
  const deposes = new Set(e.demandes.filter((d) => DEMANDE_DEPOSEE.has(d.statut)).map((d) => d.programId));
  for (const [programmeId, r] of [...retenus].sort(([a], [b]) => a.localeCompare(b))) {
    const prog = programmes.find((p) => p.id === programmeId);
    if (!prog?.dateFin || deposes.has(programmeId)) continue;
    const jours = joursEntre(e.aujourdHui, prog.dateFin);
    if (jours < 0 || jours > SEUILS_SURVEILLANCE.echeanceJours) continue;
    alertes.push({
      cle: `echeance:${programmeId}:${prog.dateFin}`,
      type: "echeance_subvention",
      gravite: jours <= SEUILS_SURVEILLANCE.echeanceCritiqueJours ? "critique" : "attention",
      lien: "financement",
      detail: { type: "echeance_subvention", programmeId, dateFin: prog.dateFin, jours, montant: r.montant, vehicules: r.vehicules },
    });
  }

  // 3. Remplacements en retard (année prévue passée, non réalisés)
  const retards = e.vehicules
    .filter((v) => v.anneeRemplacement != null && v.anneeRemplacement < anneeCourante && !v.realise)
    .map((v) => ({ id: v.id, unite: v.unite, annee: v.anneeRemplacement as number }))
    .sort((a, b) => a.annee - b.annee || a.unite.localeCompare(b.unite, "fr"));
  if (retards.length > 0) {
    alertes.push({
      cle: `retard:${retards.map((r) => `${r.id}@${r.annee}`).join(",")}`,
      type: "remplacement_retard",
      gravite: "attention",
      lien: "suivi",
      detail: { type: "remplacement_retard", vehicules: retards },
    });
  }

  // 4. Programmes modifiés (veille validée) depuis le dernier rapport
  const depuis = e.dernierRapport?.date ?? null;
  for (const ev of [...e.evenements].sort((a, b) => a.valideLe.localeCompare(b.valideLe) || a.id.localeCompare(b.id))) {
    if (!examines.has(ev.programId)) continue;
    const recent = depuis
      ? ev.valideLe > depuis
      : joursEntre(ev.valideLe, e.aujourdHui) <= SEUILS_SURVEILLANCE.evenementsSansRapportJours;
    if (!recent) continue;
    alertes.push({
      cle: `programme:${ev.id}`,
      type: "programme_modifie",
      gravite: retenus.has(ev.programId) ? "attention" : "info",
      lien: "financement",
      detail: {
        type: "programme_modifie",
        evenementId: ev.id,
        programmeId: ev.programId,
        resumeFr: ev.resumeFr,
        resumeEn: ev.resumeEn,
        valideLe: ev.valideLe.slice(0, 10),
      },
    });
  }

  // 5. Capacité des garages
  for (const g of s.infra.garages) {
    const r = g.raccordement;
    if (r.kwSupplementaires <= 0) continue;
    alertes.push({
      cle: `garage:${g.cle}:${Math.round(r.kwDemandes)}/${Math.round(r.kwDisponibles)}`,
      type: "capacite_garage",
      gravite: "attention",
      lien: "plan",
      detail: {
        type: "capacite_garage",
        garage: g.depot,
        kwDemandes: r.kwDemandes,
        kwDisponibles: r.kwDisponibles,
        kwSupplementaires: r.kwSupplementaires,
        presumee: r.kwDisponiblesSource === "presumee",
        cout: r.cout,
        source: r.source,
      },
    });
  }

  const ordre: Record<GraviteAlerte, number> = { critique: 0, attention: 1, info: 2 };
  return alertes.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);
}

export type NiveauSante = "bon" | "a_surveiller" | "a_risque";

/** Santé du plan : à risque dès une alerte critique, à surveiller dès une
 *  alerte « attention » ; les alertes marquées vues ne comptent plus. */
export function santeDuPlan(alertes: AlertePlan[], vues: ReadonlySet<string> = new Set()): {
  niveau: NiveauSante;
  critiques: number;
  attentions: number;
  infos: number;
} {
  const actives = alertes.filter((a) => !vues.has(a.cle));
  const critiques = actives.filter((a) => a.gravite === "critique").length;
  const attentions = actives.filter((a) => a.gravite === "attention").length;
  const infos = actives.filter((a) => a.gravite === "info").length;
  return { niveau: critiques > 0 ? "a_risque" : attentions > 0 ? "a_surveiller" : "bon", critiques, attentions, infos };
}
