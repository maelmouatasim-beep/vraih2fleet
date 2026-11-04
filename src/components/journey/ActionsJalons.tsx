/**
 * Suivi — actions du plan par JALON (audit B6, remplace le kanban) : une
 * section par année du plan, chaque action avec son échéance, le véhicule
 * et le programme liés, et une case « fait ». Le détail (description,
 * assignation, commentaires) reste dans le panneau de la tâche.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, StatusBadge } from "@/components/layout/States";
import { TaskForm } from "@/components/tasks/TaskForm";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { useTasks } from "@/hooks/useTasks";
import type { CreateTaskInput, Task, UpdateTaskInput } from "@/types/project-management";
import { actionsParJalon } from "@/lib/journey/actions";
import { nomCourtProgramme } from "@/lib/tco/translations-en";
import { formaterDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  /** Numéro d'unité de chaque véhicule du projet (id → unité). */
  unites: Map<string, string>;
}

export default function ActionsJalons({ projectId, unites }: Props) {
  const { t, i18n } = useTranslation();
  const langue = i18n.language.startsWith("en") ? "en" : "fr";
  const { tasks, isLoading, createTask, updateTask, deleteTask, moveTask } = useTasks(projectId);
  const [creation, setCreation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [ouverte, setOuverte] = useState<Task | null>(null);
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const groupes = useMemo(() => actionsParJalon(tasks, aujourdHui), [tasks, aujourdHui]);
  const parId = useMemo(() => new Map(tasks.map((x) => [x.id, x])), [tasks]);

  const basculer = (id: string, fait: boolean) => {
    const tache = parId.get(id);
    if (tache) void moveTask(id, fait ? "todo" : "completed", tache.orderIndex);
  };
  const creer = async (data: CreateTaskInput | UpdateTaskInput) => {
    setEnvoi(true);
    const ok = await createTask(data as CreateTaskInput);
    setEnvoi(false);
    if (ok) setCreation(false);
  };
  const modifierTache = async (data: UpdateTaskInput) => {
    if (!ouverte) return;
    setEnvoi(true);
    await updateTask(ouverte.id, data);
    setEnvoi(false);
    setOuverte(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="actions-jalons">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreation(true)}>
          <Plus className="w-4 h-4 mr-1" /> {t("journey.tracking.actions.new")}
        </Button>
      </div>

      {groupes.length === 0 && <EmptyState titre={t("journey.tracking.actions.empty")} />}

      {groupes.map((g) => (
        <section key={g.annee ?? "sans"} data-testid={`jalon-${g.annee ?? "sans"}`} className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-1">
            <h3 className="font-semibold">
              {g.annee != null ? t("journey.tracking.actions.milestone", { year: g.annee }) : t("journey.tracking.actions.noDate")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("journey.tracking.actions.progress", { done: g.faites, count: g.actions.length })}
              {g.enRetard > 0 && (
                <span className="text-destructive"> · {t("journey.tracking.actions.overdue", { count: g.enRetard })}</span>
              )}
            </p>
          </div>
          <ul className="divide-y divide-border">
            {g.actions.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2" data-testid="action-ligne">
                <Checkbox
                  className="mt-0.5"
                  checked={a.fait}
                  onCheckedChange={() => basculer(a.id, a.fait)}
                  aria-label={t(a.fait ? "journey.tracking.actions.markTodo" : "journey.tracking.actions.markDone", { title: a.title })}
                  data-testid="action-fait"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <button
                    type="button"
                    className={cn("text-left text-sm font-medium hover:underline", a.fait && "text-muted-foreground line-through")}
                    onClick={() => setOuverte(parId.get(a.id) ?? null)}
                  >
                    {a.title}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {[
                      a.vehicleId && unites.get(a.vehicleId)
                        ? t("journey.tracking.actions.vehicle", { unit: unites.get(a.vehicleId) })
                        : null,
                      a.subsidyProgram ? nomCourtProgramme(a.subsidyProgram, langue) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  {a.dueDate && (
                    <span className={cn("whitespace-nowrap tabular-nums", a.enRetard ? "text-destructive font-medium" : "text-muted-foreground")}>
                      {t("journey.tracking.actions.due", { date: formaterDate(i18n.language, `${a.dueDate}T12:00:00`) })}
                    </span>
                  )}
                  {a.enRetard && <StatusBadge ton="danger">{t("journey.tracking.actions.late")}</StatusBadge>}
                  {!a.fait && a.status === "in_progress" && <StatusBadge ton="info">{t("tasks.status.in_progress")}</StatusBadge>}
                  {!a.fait && a.status === "blocked" && <StatusBadge ton="attention">{t("tasks.status.blocked")}</StatusBadge>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Dialog open={creation} onOpenChange={setCreation}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("journey.tracking.actions.new")}</DialogTitle>
          </DialogHeader>
          <TaskForm projectId={projectId} onSubmit={creer} onCancel={() => setCreation(false)} isLoading={envoi} />
        </DialogContent>
      </Dialog>

      <TaskDetailDrawer
        task={ouverte}
        isOpen={!!ouverte}
        onClose={() => setOuverte(null)}
        onUpdate={modifierTache}
        onDelete={async () => {
          if (ouverte) await deleteTask(ouverte.id);
          setOuverte(null);
        }}
      />
    </div>
  );
}
