import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Task, TaskStatus, TASK_STATUS_CONFIG } from '@/types/project-management';
import { TaskCard } from './TaskCard';
import { TaskForm } from './TaskForm';
import { TaskDetailDrawer } from './TaskDetailDrawer';
import { useTasks } from '@/hooks/useTasks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Loader2, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskBoardProps {
  projectId: string;
}

const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'completed'];

export function TaskBoard({ projectId }: TaskBoardProps) {
  const { t } = useTranslation();
  const { tasks, tasksByStatus, stats, isLoading, createTask, updateTask, deleteTask, moveTask } = useTasks(projectId);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const handleCreateTask = async (data: any) => {
    setIsSubmitting(true);
    const result = await createTask(data);
    setIsSubmitting(false);
    if (result) {
      setIsCreateDialogOpen(false);
    }
  };

  const handleUpdateTask = async (taskId: string, data: any) => {
    setIsSubmitting(true);
    await updateTask(taskId, data);
    setIsSubmitting(false);
    setSelectedTask(null);
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
    setSelectedTask(null);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === newStatus) {
      setDraggedTask(null);
      return;
    }

    // Get the new order index (append to end of column)
    const tasksInColumn = tasksByStatus[newStatus];
    const newOrderIndex = tasksInColumn.length;

    await moveTask(draggedTask.id, newStatus, newOrderIndex);
    setDraggedTask(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">{t('tasks.title', 'Tasks')}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{stats.completed}/{stats.total} {t('tasks.completed', 'completed')}</span>
            {stats.overdue > 0 && (
              <span className="text-red-500">• {stats.overdue} {t('tasks.overdue', 'overdue')}</span>
            )}
            {stats.overBudget > 0 && (
              <span className="text-orange-500">• {stats.overBudget} {t('tasks.overBudget', 'over budget')}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 px-2"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 px-2"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            {t('tasks.newTask', 'New task')}
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === 'kanban' && (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 h-full pb-4">
            {STATUS_ORDER.map((status) => {
              const config = TASK_STATUS_CONFIG[status];
              const columnTasks = tasksByStatus[status];

              return (
                <div
                  key={status}
                  className={cn(
                    'flex-1 min-w-[15rem] rounded-lg p-3',
                    config.color
                  )}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-sm">
                      {t(config.labelKey)}
                    </h3>
                    <span className="text-xs text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Tasks */}
                  <ScrollArea className="h-[calc(100vh-280px)]">
                    <div className="space-y-2 pr-2">
                      {columnTasks.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDragEnd={() => setDraggedTask(null)}
                        >
                          <TaskCard
                            task={task}
                            onClick={() => setSelectedTask(task)}
                            isDragging={draggedTask?.id === task.id}
                          />
                        </div>
                      ))}

                      {columnTasks.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          {t('tasks.noTasks', 'No tasks')}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => setSelectedTask(task)}
              />
            ))}
            {tasks.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                {t('tasks.noTasksForProject', 'No tasks for this project')}
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Create Task Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('tasks.newTask', 'New task')}</DialogTitle>
          </DialogHeader>
          <TaskForm
            projectId={projectId}
            onSubmit={handleCreateTask}
            onCancel={() => setIsCreateDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={(data) => selectedTask && handleUpdateTask(selectedTask.id, data)}
        onDelete={() => selectedTask && handleDeleteTask(selectedTask.id)}
      />
    </div>
  );
}
