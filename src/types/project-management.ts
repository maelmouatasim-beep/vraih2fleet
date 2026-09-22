// Types for the Integrated Project Management Module

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  milestoneId: string | null;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  
  // Budget tracking
  budgetAllocated: number;
  budgetSpent: number;
  
  // Timeline
  startDate: string | null;
  dueDate: string | null;
  completedDate: string | null;
  
  // Assignments
  assignedTo: string[];
  
  // Dependencies
  dependsOn: string[];
  blockedBy: string | null;
  
  // Computed flags
  isOverdue: boolean;
  isOverBudget: boolean;
  
  // Priority & ordering
  priority: TaskPriority;
  orderIndex: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  
  // Enriched data (from joins)
  assignees?: UserProfile[];
  milestone?: { id: string; title: string };
  commentsCount?: number;
  attachmentsCount?: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
  
  // Enriched
  user?: UserProfile;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  fileType: string | null;
  uploadedBy: string | null;
  createdAt: string;
  
  // Enriched
  uploader?: UserProfile;
}

export interface UserProfile {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  email?: string;
}

// Database row types
export interface TaskRow {
  id: string;
  milestone_id: string | null;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  budget_allocated: number;
  budget_spent: number;
  start_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  assigned_to: string[];
  depends_on: string[];
  blocked_by: string | null;
  is_overdue: boolean;
  is_over_budget: boolean;
  priority: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface TaskCommentRow {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  mentions: string[];
  created_at: string;
  updated_at: string;
}

export interface TaskAttachmentRow {
  id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

// Input types for mutations
export interface CreateTaskInput {
  projectId: string;
  milestoneId?: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  budgetAllocated?: number;
  startDate?: string;
  dueDate?: string;
  assignedTo?: string[];
  dependsOn?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  budgetAllocated?: number;
  budgetSpent?: number;
  startDate?: string;
  dueDate?: string;
  completedDate?: string;
  assignedTo?: string[];
  dependsOn?: string[];
  blockedBy?: string;
  orderIndex?: number;
  milestoneId?: string | null;
}

// Kanban board helpers
export const TASK_STATUS_CONFIG: Record<TaskStatus, { labelKey: string; color: string }> = {
  todo: { labelKey: 'tasks.status.todo', color: 'bg-muted' },
  in_progress: { labelKey: 'tasks.status.in_progress', color: 'bg-blue-500/20' },
  blocked: { labelKey: 'tasks.status.blocked', color: 'bg-red-500/20' },
  completed: { labelKey: 'tasks.status.completed', color: 'bg-green-500/20' },
};

export const TASK_PRIORITY_CONFIG: Record<TaskPriority, { labelKey: string; color: string; icon: string }> = {
  low: { labelKey: 'tasks.priority.low', color: 'text-muted-foreground', icon: '↓' },
  medium: { labelKey: 'tasks.priority.medium', color: 'text-yellow-500', icon: '→' },
  high: { labelKey: 'tasks.priority.high', color: 'text-orange-500', icon: '↑' },
  urgent: { labelKey: 'tasks.priority.urgent', color: 'text-red-500', icon: '🔥' },
};

// Helper to convert DB row to Task
export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    milestoneId: row.milestone_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    budgetAllocated: Number(row.budget_allocated) || 0,
    budgetSpent: Number(row.budget_spent) || 0,
    startDate: row.start_date,
    dueDate: row.due_date,
    completedDate: row.completed_date,
    assignedTo: row.assigned_to || [],
    dependsOn: row.depends_on || [],
    blockedBy: row.blocked_by,
    isOverdue: row.is_overdue,
    isOverBudget: row.is_over_budget,
    priority: row.priority as TaskPriority,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

export function rowToTaskComment(row: TaskCommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    content: row.content,
    mentions: row.mentions || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
