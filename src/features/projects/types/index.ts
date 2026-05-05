import { z } from 'zod'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const WORK_ITEM_TYPES = ['task', 'bug', 'milestone', 'epic'] as const
export type WorkItemType = typeof WORK_ITEM_TYPES[number]

export const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const
export type Priority = typeof PRIORITIES[number]

export const PROJECT_VISIBILITY = ['private', 'team', 'public'] as const
export type ProjectVisibility = typeof PROJECT_VISIBILITY[number]

export const PROJECT_TEMPLATES = ['kanban', 'scrum', 'custom'] as const
export type ProjectTemplate = typeof PROJECT_TEMPLATES[number]

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'select', 'multiSelect', 'date', 'user', 'url'] as const
export type CustomFieldType = typeof CUSTOM_FIELD_TYPES[number]

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------
export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  icon: z.string().default('folder-kanban'),
  color: z.string().default('#6366f1'),
  visibility: z.enum(PROJECT_VISIBILITY).default('team'),
  template: z.enum(PROJECT_TEMPLATES).default('kanban'),
  createdBy: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export type Project = z.infer<typeof projectSchema>

// ---------------------------------------------------------------------------
// Work Item
// ---------------------------------------------------------------------------
export const workItemSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  parentId: z.string().optional(),
  type: z.enum(WORK_ITEM_TYPES).default('task'),
  title: z.string().min(1),
  description: z.string().default(''),
  status: z.string().min(1),
  priority: z.enum(PRIORITIES).default('none'),
  assignee: z.string().optional(),
  dueDate: z.number().int().nonnegative().optional(),
  order: z.number().int().nonnegative(),
  customFields: z.record(z.string(), z.unknown()).default({}),
  chatRoomId: z.string().optional(),
  linkedDecisions: z.array(z.string()).default([]),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export type WorkItem = z.infer<typeof workItemSchema>

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------
export const workflowStatusSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  color: z.string(),
  category: z.enum(['todo', 'in_progress', 'done']),
})

export const workflowTransitionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  name: z.string().optional(),
})

export const workflowSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  statuses: z.array(workflowStatusSchema),
  transitions: z.array(workflowTransitionSchema),
})

export type WorkflowStatus = z.infer<typeof workflowStatusSchema>
export type WorkflowTransition = z.infer<typeof workflowTransitionSchema>
export type Workflow = z.infer<typeof workflowSchema>

// ---------------------------------------------------------------------------
// Custom Field
// ---------------------------------------------------------------------------
export const customFieldSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string()).default([]),
  required: z.boolean().default(false),
  order: z.number().int().nonnegative(),
})

export type CustomField = z.infer<typeof customFieldSchema>

// ---------------------------------------------------------------------------
// Sync message types
// ---------------------------------------------------------------------------
export const PROJECT_SYNC_EVENT_TYPES = [
  'muon.project.workitem.create',
  'muon.project.workitem.update',
  'muon.project.workitem.delete',
  'muon.project.workitem.reorder',
  'muon.project.workflow.update',
  'muon.project.field.update',
] as const

export type ProjectSyncEventType = typeof PROJECT_SYNC_EVENT_TYPES[number]

export interface ProjectSyncPayload {
  type: ProjectSyncEventType
  projectId: string
  ts: number
  sender: string
  data: {
    workItemId?: string
    workItem?: WorkItem
    changes?: Partial<WorkItem>
    newOrder?: number
    statusColumn?: string
    workflow?: Workflow
    field?: CustomField
  }
}

// ---------------------------------------------------------------------------
// View types
// ---------------------------------------------------------------------------
export type ProjectView = 'board' | 'list' | 'gantt'

export interface ViewConfig {
  sortBy: 'order' | 'priority' | 'dueDate' | 'createdAt' | 'title'
  sortDir: 'asc' | 'desc'
  filters: ViewFilter[]
  groupBy?: 'status' | 'assignee' | 'priority'
}

export interface ViewFilter {
  field: string
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt'
  value: unknown
}
