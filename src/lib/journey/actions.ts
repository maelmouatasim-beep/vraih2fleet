/**
 * Étape 7 — Suivi : actions du plan regroupées par JALON (audit B6,
 * remplace le kanban). Logique PURE, testée.
 *
 * Un jalon = une année du plan : celle du remplacement ou de la demande
 * de subvention à laquelle l'action est liée (plan_year), sinon l'année de
 * son échéance ; une action sans année ni échéance va dans « sans
 * échéance », en dernier. Dans un jalon : actions à faire d'abord, par
 * échéance croissante ; les actions faites ensuite.
 */

export type StatutAction = "todo" | "in_progress" | "blocked" | "completed";

export interface TacheSource {
  id: string;
  title: string;
  status: StatutAction;
  dueDate: string | null;
  planYear?: number | null;
  vehicleId?: string | null;
  subsidyProgram?: string | null;
  orderIndex: number;
}

export interface ActionSuivi extends TacheSource {
  fait: boolean;
  /** Échéance dépassée et action non faite. */
  enRetard: boolean;
}

export interface GroupeJalon {
  /** Année du jalon ; null = sans échéance. */
  annee: number | null;
  actions: ActionSuivi[];
  faites: number;
  enRetard: number;
}

/** Année du jalon d'une tâche (plan_year, sinon année de l'échéance). */
export function anneeJalon(t: Pick<TacheSource, "planYear" | "dueDate">): number | null {
  if (t.planYear != null) return t.planYear;
  const m = /^(\d{4})-\d{2}-\d{2}/.exec(t.dueDate ?? "");
  return m ? Number(m[1]) : null;
}

/** `aujourdHui` au format AAAA-MM-JJ. */
export function actionsParJalon(taches: TacheSource[], aujourdHui: string): GroupeJalon[] {
  const groupes = new Map<number | null, ActionSuivi[]>();
  for (const t of taches) {
    const fait = t.status === "completed";
    const action: ActionSuivi = { ...t, fait, enRetard: !fait && t.dueDate != null && t.dueDate < aujourdHui };
    const annee = anneeJalon(t);
    const liste = groupes.get(annee) ?? [];
    liste.push(action);
    groupes.set(annee, liste);
  }
  const ordre = (a: ActionSuivi, b: ActionSuivi) =>
    Number(a.fait) - Number(b.fait) ||
    (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
    a.orderIndex - b.orderIndex ||
    a.title.localeCompare(b.title, "fr");
  return [...groupes.entries()]
    .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
    .map(([annee, actions]) => {
      const triees = [...actions].sort(ordre);
      return {
        annee,
        actions: triees,
        faites: triees.filter((x) => x.fait).length,
        enRetard: triees.filter((x) => x.enRetard).length,
      };
    });
}
