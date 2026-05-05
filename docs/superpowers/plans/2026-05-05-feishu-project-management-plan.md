# Feishu Project Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project management module (飞书项目 style) with hybrid Matrix + Dexie architecture, multi-view boards, workflows, and cross-module integrations.

**Architecture:** Hybrid — project metadata lives in Matrix Room state events for auth/sync/notifications; work items, workflows, and custom fields live in Dexie (IndexedDB) for high-performance CRUD and complex queries. Cross-device sync via custom Matrix timeline messages with last-write-wins field-level merging.

**Tech Stack:** Vue 3 + TypeScript + Pinia + Dexie.js + Matrix JS SDK + TipTap (rich text) + lucide-vue-next (icons)

---

## File Plan

| File | Responsibility |
|---|---|
| `src/features/projects/types/index.ts` | All type definitions and Zod schemas |
| `src/features/projects/db/projectDb.ts` | Dexie database class and repository |
| `src/features/projects/composables/useProjectStore.ts` | Pinia store — project CRUD + Matrix sync |
| `src/features/projects/composables/useWorkItemStore.ts` | Pinia store — work item CRUD + Matrix sync |
| `src/features/projects/composables/useWorkflow.ts` | Workflow state machine (valid transitions) |
| `src/features/projects/composables/useProjectSync.ts` | Matrix ↔ Dexie sync protocol handler |
| `src/features/projects/ProjectsPage.vue` | Route entry point with view switching |
| `src/features/projects/components/ProjectList.vue` | Project grid/list with create button |
| `src/features/projects/components/ProjectCreateDialog.vue` | Create/edit project modal |
| `src/features/projects/components/ProjectDetail.vue` | Project header + view container |
| `src/features/projects/components/ProjectSettings.vue` | Tabs: workflow editor, field editor, general |
| `src/features/projects/components/WorkItemCard.vue` | Kanban card with priority/due/assignee |
| `src/features/projects/components/WorkItemCreateDialog.vue` | Create work item modal |
| `src/features/projects/components/WorkItemDetail.vue` | Side panel — full detail + description editor |
| `src/features/projects/components/WorkItemRow.vue` | Table row for list view |
| `src/features/projects/components/view/BoardView.vue` | Kanban columns with drag-and-drop |
| `src/features/projects/components/view/ListView.vue` | Sortable/filterable table |
| `src/features/projects/components/view/GanttView.vue` | Timeline/gantt chart |
| `src/features/projects/components/settings/WorkflowEditor.vue` | Status & transition CRUD |
| `src/features/projects/components/settings/CustomFieldEditor.vue` | Custom field CRUD |
| `src/features/projects/index.ts` | Barrel export |
| `src/matrix/projects.ts` | Matrix layer — send/receive sync events |
| `src/app/components/workspace/navigation.ts` | Add 'projects' app entry |
| `src/app/router/index.ts` | Add /projects routes |
| `src/locales/zh.json` | Chinese i18n keys |
| `src/locales/en.json` | English i18n keys |
| `tests/unit/projects/` | All unit tests |

---

## Phase 1: Foundation (Types, DB, Navigation)

### Task 1: Types and Zod Schemas

**Files:**
- Create: `src/features/projects/types/index.ts`

- [ ] **Step 1: Write types and schemas**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/types/index.ts
git commit -m "feat(projects): add type definitions and Zod schemas"
```

---

### Task 2: Dexie Database and Repository

**Files:**
- Create: `src/features/projects/db/projectDb.ts`

- [ ] **Step 1: Write the Dexie database class**

```typescript
import type { EntityTable } from 'dexie'
import type { CustomField, Project, Workflow, WorkItem } from '../types'
import Dexie from 'dexie'
import { customFieldSchema, projectSchema, workflowSchema, workItemSchema } from '../types'

export const PROJECT_DB_NAME = 'MuonProjectDB'

export const PROJECT_DB_STORES = {
  projects: 'id, createdBy, createdAt, updatedAt',
  workItems: 'id, projectId, parentId, type, status, priority, assignee, dueDate, order, createdAt, updatedAt',
  workflows: 'id, projectId',
  customFields: 'id, projectId',
} as const

export class MuonProjectDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  workItems!: EntityTable<WorkItem, 'id'>
  workflows!: EntityTable<Workflow, 'id'>
  customFields!: EntityTable<CustomField, 'id'>

  constructor() {
    super(PROJECT_DB_NAME)
    this.version(1).stores(PROJECT_DB_STORES)
  }
}

export const projectDb = new MuonProjectDB()

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
export function createProjectRepository(db = projectDb) {
  return {
    // ---- Projects ----
    async saveProject(project: Project) {
      const parsed = projectSchema.parse(project)
      await db.projects.put(parsed)
      return parsed
    },

    async getProject(id: string) {
      return db.projects.get(id)
    },

    async listProjects() {
      return db.projects.orderBy('updatedAt').reverse().toArray()
    },

    async deleteProject(id: string) {
      await db.projects.delete(id)
      await db.workItems.where('projectId').equals(id).delete()
      await db.workflows.where('projectId').equals(id).delete()
      await db.customFields.where('projectId').equals(id).delete()
    },

    // ---- Work Items ----
    async saveWorkItem(item: WorkItem) {
      const parsed = workItemSchema.parse(item)
      await db.workItems.put(parsed)
      return parsed
    },

    async getWorkItem(id: string) {
      return db.workItems.get(id)
    },

    async listWorkItems(projectId: string) {
      return db.workItems
        .where('projectId').equals(projectId)
        .sortBy('order')
    },

    async listWorkItemsByStatus(projectId: string, status: string) {
      return db.workItems
        .where('[projectId+status]').equals([projectId, status])
        .sortBy('order')
    },

    async updateWorkItem(id: string, changes: Partial<WorkItem>) {
      const existing = await db.workItems.get(id)
      if (!existing) throw new Error(`WorkItem ${id} not found`)
      const updated = workItemSchema.parse({ ...existing, ...changes, updatedAt: Date.now() })
      await db.workItems.update(id, updated)
      return updated
    },

    async deleteWorkItem(id: string) {
      await db.workItems.delete(id)
    },

    async reorderWorkItem(id: string, newOrder: number, status: string) {
      const existing = await db.workItems.get(id)
      if (!existing) throw new Error(`WorkItem ${id} not found`)
      const updated = workItemSchema.parse({ ...existing, order: newOrder, status, updatedAt: Date.now() })
      await db.workItems.update(id, updated)
      return updated
    },

    // ---- Workflows ----
    async saveWorkflow(workflow: Workflow) {
      const parsed = workflowSchema.parse(workflow)
      await db.workflows.put(parsed)
      return parsed
    },

    async getWorkflow(projectId: string) {
      return db.workflows.where('projectId').equals(projectId).first()
    },

    // ---- Custom Fields ----
    async saveCustomField(field: CustomField) {
      const parsed = customFieldSchema.parse(field)
      await db.customFields.put(parsed)
      return parsed
    },

    async listCustomFields(projectId: string) {
      return db.customFields
        .where('projectId').equals(projectId)
        .sortBy('order')
    },

    async deleteCustomField(id: string) {
      await db.customFields.delete(id)
    },
  }
}

export const projectRepo = createProjectRepository()
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/db/projectDb.ts
git commit -m "feat(projects): add Dexie database and repository"
```

---

### Task 3: Matrix Sync Layer

**Files:**
- Create: `src/matrix/projects.ts`
- Modify: `src/matrix/index.ts:54-55`

- [ ] **Step 1: Write the Matrix sync handler**

```typescript
import type { MatrixEvent } from 'matrix-js-sdk'
import type { ProjectSyncPayload } from '@/features/projects/types'
import { EventType } from 'matrix-js-sdk'
import { getClient } from './client'

const SYNC_EVENT_TYPE = EventType.RoomMessage

export async function sendProjectSyncEvent(
  roomId: string,
  payload: ProjectSyncPayload,
): Promise<void> {
  const client = getClient()
  await client.sendEvent(roomId, SYNC_EVENT_TYPE, {
    msgtype: 'muon.project.sync',
    body: JSON.stringify(payload),
  })
}

export function isProjectSyncEvent(event: MatrixEvent): boolean {
  const content = event.getContent()
  return content.msgtype === 'muon.project.sync'
}

export function parseProjectSyncPayload(event: MatrixEvent): ProjectSyncPayload | null {
  try {
    const content = event.getContent<{ body: string }>()
    return JSON.parse(content.body) as ProjectSyncPayload
  }
  catch {
    return null
  }
}
```

- [ ] **Step 2: Add exports to `src/matrix/index.ts`**

Add after line 55 (`export { materializeOfflineDigest } from './digest'`):

```typescript
export { isProjectSyncEvent, parseProjectSyncPayload, sendProjectSyncEvent } from './projects'
```

- [ ] **Step 3: Commit**

```bash
git add src/matrix/projects.ts src/matrix/index.ts
git commit -m "feat(projects): add Matrix sync protocol layer"
```

---

### Task 4: Pinia Stores (Project + WorkItem)

**Files:**
- Create: `src/features/projects/composables/useProjectStore.ts`
- Create: `src/features/projects/composables/useWorkItemStore.ts`

- [ ] **Step 1: Write useProjectStore**

```typescript
import type { Project, ProjectTemplate, ProjectVisibility } from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getClient } from '@/matrix'
import { sendProjectSyncEvent } from '@/matrix/projects'
import { projectRepo } from '../db/projectDb'
import { projectSchema } from '../types'

function generateId(): string {
  return crypto.randomUUID()
}

export const useProjectStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const currentProjectId = ref<string | null>(null)

  async function loadProjects() {
    loading.value = true
    try {
      projects.value = await projectRepo.listProjects()
    }
    finally {
      loading.value = false
    }
  }

  async function createProject(data: {
    name: string
    description?: string
    visibility?: ProjectVisibility
    template?: ProjectTemplate
  }): Promise<Project> {
    const client = getClient()
    const userId = client.getUserId()!

    // Create Matrix room for the project
    const { room_id: roomId } = await client.createRoom({
      name: data.name,
      topic: data.description ?? '',
      preset: data.visibility === 'public' ? 'public_chat' : 'private_chat',
    })

    const now = Date.now()
    const project: Project = projectSchema.parse({
      id: roomId,
      name: data.name,
      description: data.description ?? '',
      visibility: data.visibility ?? 'team',
      template: data.template ?? 'kanban',
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    })

    await projectRepo.saveProject(project)
    projects.value.unshift(project)
    return project
  }

  async function updateProject(id: string, changes: Partial<Project>): Promise<Project> {
    const existing = await projectRepo.getProject(id)
    if (!existing) throw new Error(`Project ${id} not found`)

    const updated = projectSchema.parse({ ...existing, ...changes, updatedAt: Date.now() })
    await projectRepo.saveProject(updated)

    const idx = projects.value.findIndex(p => p.id === id)
    if (idx !== -1) projects.value.splice(idx, 1, updated)

    return updated
  }

  async function deleteProject(id: string) {
    const client = getClient()
    await client.leave(id)
    await projectRepo.deleteProject(id)
    projects.value = projects.value.filter(p => p.id !== id)
  }

  function setCurrentProject(id: string | null) {
    currentProjectId.value = id
  }

  return {
    projects,
    loading,
    currentProjectId,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    setCurrentProject,
  }
})
```

- [ ] **Step 2: Write useWorkItemStore**

```typescript
import type { WorkItem } from '../types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getClient } from '@/matrix'
import { sendProjectSyncEvent } from '@/matrix/projects'
import { projectRepo } from '../db/projectDb'
import { workItemSchema } from '../types'

function generateId(): string {
  return crypto.randomUUID()
}

export const useWorkItemStore = defineStore('workItems', () => {
  const itemsByProject = ref<Record<string, WorkItem[]>>({})
  const loading = ref(false)

  const currentProjectId = ref<string | null>(null)

  const currentItems = computed(() => {
    if (!currentProjectId.value) return []
    return itemsByProject.value[currentProjectId.value] ?? []
  })

  const itemsByStatus = computed(() => {
    const grouped: Record<string, WorkItem[]> = {}
    for (const item of currentItems.value) {
      const key = item.status
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(item)
    }
    return grouped
  })

  async function loadItems(projectId: string) {
    loading.value = true
    try {
      const items = await projectRepo.listWorkItems(projectId)
      itemsByProject.value[projectId] = items
    }
    finally {
      loading.value = false
    }
  }

  async function createItem(projectId: string, data: {
    title: string
    description?: string
    status: string
    type?: WorkItem['type']
    priority?: WorkItem['priority']
    assignee?: string
    dueDate?: number
    parentId?: string
  }): Promise<WorkItem> {
    const items = itemsByProject.value[projectId] ?? []
    const maxOrder = items.reduce((max, i) => Math.max(max, i.order), -1)

    const now = Date.now()
    const item: WorkItem = workItemSchema.parse({
      id: generateId(),
      projectId,
      parentId: data.parentId,
      type: data.type ?? 'task',
      title: data.title,
      description: data.description ?? '',
      status: data.status,
      priority: data.priority ?? 'none',
      assignee: data.assignee,
      dueDate: data.dueDate,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    })

    await projectRepo.saveWorkItem(item)
    if (itemsByProject.value[projectId]) {
      itemsByProject.value[projectId].push(item)
    }
    else {
      itemsByProject.value[projectId] = [item]
    }

    // Sync via Matrix
    const client = getClient()
    if (client) {
      sendProjectSyncEvent(projectId, {
        type: 'muon.project.workitem.create',
        projectId,
        ts: now,
        sender: client.getUserId()!,
        data: { workItemId: item.id, workItem: item },
      }).catch(() => { /* sync is best-effort */ })
    }

    return item
  }

  async function updateItem(id: string, changes: Partial<WorkItem>): Promise<WorkItem> {
    const updated = await projectRepo.updateWorkItem(id, changes)
    const list = itemsByProject.value[updated.projectId]
    if (list) {
      const idx = list.findIndex(i => i.id === id)
      if (idx !== -1) list.splice(idx, 1, updated)
    }

    const client = getClient()
    if (client) {
      sendProjectSyncEvent(updated.projectId, {
        type: 'muon.project.workitem.update',
        projectId: updated.projectId,
        ts: Date.now(),
        sender: client.getUserId()!,
        data: { workItemId: id, changes },
      }).catch(() => {})
    }

    return updated
  }

  async function deleteItem(id: string, projectId: string) {
    await projectRepo.deleteWorkItem(id)
    const list = itemsByProject.value[projectId]
    if (list) {
      itemsByProject.value[projectId] = list.filter(i => i.id !== id)
    }

    const client = getClient()
    if (client) {
      sendProjectSyncEvent(projectId, {
        type: 'muon.project.workitem.delete',
        projectId,
        ts: Date.now(),
        sender: client.getUserId()!,
        data: { workItemId: id },
      }).catch(() => {})
    }
  }

  async function reorderItem(id: string, projectId: string, newOrder: number, statusColumn: string) {
    const updated = await projectRepo.reorderWorkItem(id, newOrder, statusColumn)
    const list = itemsByProject.value[projectId]
    if (list) {
      const idx = list.findIndex(i => i.id === id)
      if (idx !== -1) list.splice(idx, 1, updated)
    }

    const client = getClient()
    if (client) {
      sendProjectSyncEvent(projectId, {
        type: 'muon.project.workitem.reorder',
        projectId,
        ts: Date.now(),
        sender: client.getUserId()!,
        data: { workItemId: id, newOrder, statusColumn },
      }).catch(() => {})
    }

    return updated
  }

  function setCurrentProject(projectId: string | null) {
    currentProjectId.value = projectId
  }

  return {
    itemsByProject,
    loading,
    currentProjectId,
    currentItems,
    itemsByStatus,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    reorderItem,
    setCurrentProject,
  }
})
```

- [ ] **Step 3: Commit**

```bash
git add src/features/projects/composables/useProjectStore.ts src/features/projects/composables/useWorkItemStore.ts
git commit -m "feat(projects): add Pinia stores for project and work item CRUD"
```

---

### Task 5: Workflow State Machine

**Files:**
- Create: `src/features/projects/composables/useWorkflow.ts`

- [ ] **Step 1: Write useWorkflow composable**

```typescript
import type { Workflow, WorkflowStatus } from '../types'
import { computed } from 'vue'
import { projectRepo } from '../db/projectDb'
import { useWorkItemStore } from './useWorkItemStore'

const DEFAULT_WORKFLOW: Omit<Workflow, 'projectId'> = {
  id: '',
  statuses: [
    { key: 'todo', name: '待办', color: '#e5e7eb', category: 'todo' as const },
    { key: 'in_progress', name: '进行中', color: '#3b82f6', category: 'in_progress' as const },
    { key: 'done', name: '已完成', color: '#22c55e', category: 'done' as const },
  ],
  transitions: [
    { from: 'todo', to: 'in_progress', name: '开始处理' },
    { from: 'in_progress', to: 'done', name: '完成' },
    { from: 'in_progress', to: 'todo', name: '退回' },
    { from: 'done', to: 'in_progress', name: '重新打开' },
  ],
}

function createDefaultWorkflow(projectId: string): Workflow {
  return {
    ...DEFAULT_WORKFLOW,
    id: crypto.randomUUID(),
    projectId,
  }
}

export function useWorkflow(projectId: () => string) {
  const itemStore = useWorkItemStore()

  async function loadWorkflow(): Promise<Workflow> {
    const pid = projectId()
    let wf = await projectRepo.getWorkflow(pid)
    if (!wf) {
      wf = createDefaultWorkflow(pid)
      await projectRepo.saveWorkflow(wf)
    }
    return wf
  }

  async function saveWorkflow(workflow: Workflow): Promise<Workflow> {
    await projectRepo.saveWorkflow(workflow)
    return workflow
  }

  function canTransition(wf: Workflow, fromStatus: string, toStatus: string): boolean {
    return wf.transitions.some(t => t.from === fromStatus && t.to === toStatus)
  }

  function getAvailableTransitions(wf: Workflow, currentStatus: string): string[] {
    return wf.transitions
      .filter(t => t.from === currentStatus)
      .map(t => t.to)
  }

  async function changeStatus(itemId: string, toStatus: string): Promise<void> {
    const pid = projectId()
    const wf = await loadWorkflow()
    const item = await projectRepo.getWorkItem(itemId)
    if (!item) throw new Error('Work item not found')

    if (!canTransition(wf, item.status, toStatus)) {
      throw new Error(`Cannot transition from "${item.status}" to "${toStatus}"`)
    }

    await itemStore.updateItem(itemId, { status: toStatus })
  }

  const statusesByCategory = computed(() => {
    const grouped: Record<string, WorkflowStatus[]> = { todo: [], in_progress: [], done: [] }
    return grouped
  })

  return {
    loadWorkflow,
    saveWorkflow,
    canTransition,
    getAvailableTransitions,
    changeStatus,
    statusesByCategory,
    DEFAULT_WORKFLOW,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/composables/useWorkflow.ts
git commit -m "feat(projects): add workflow state machine composable"
```

---

### Task 6: Navigation & Routes Integration

**Files:**
- Modify: `src/app/components/workspace/navigation.ts:4,23-33`
- Modify: `src/app/router/index.ts:62-63`
- Modify: `src/locales/zh.json:617-640`
- Modify: `src/locales/en.json:617-640`

- [ ] **Step 1: Add navigation entry**

In `src/app/components/workspace/navigation.ts`:

```typescript
// Line 1: add import
import { Building2, CalendarDays, CheckSquare, FileText, FolderKanban, Grid3X3, Mail, MessageCircle, Phone, Settings, Users } from 'lucide-vue-next'

// Line 4: update type
export type WorkspaceAppId = 'messages' | 'contacts' | 'organization' | 'calendar' | 'docs' | 'workplace' | 'approvals' | 'email' | 'calls' | 'projects' | 'settings'

// After line 31 (calls entry), insert:
{ id: 'projects', labelKey: 'sidebar.projects', path: '/projects', icon: FolderKanban, match: path => matchesPrefix(path, '/projects') },
```

- [ ] **Step 2: Add route**

In `src/app/router/index.ts`, after the `/calls` route (line 78):

```typescript
{
  path: 'projects',
  name: 'projects',
  component: () => import('@features/projects/ProjectsPage.vue'),
},
```

- [ ] **Step 3: Add i18n keys**

In both `src/locales/zh.json` and `src/locales/en.json`, add to the `sidebar` section:

zh.json — after `"calls": "通话",`:
```json
"projects": "项目",
```

en.json — after `"calls": "Calls",`:
```json
"projects": "Projects",
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/workspace/navigation.ts src/app/router/index.ts src/locales/zh.json src/locales/en.json
git commit -m "feat(projects): add navigation entry, route, and i18n keys"
```

---

### Task 7: ProjectCreateDialog Component

**Files:**
- Create: `src/features/projects/components/ProjectCreateDialog.vue`

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@muon/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@muon/ui/dialog'
import { Input } from '@muon/ui/input'
import { Label } from '@muon/ui/label'
import { useProjectStore } from '../composables/useProjectStore'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'created': [projectId: string]
}>()

const { t } = useI18n()
const router = useRouter()
const store = useProjectStore()

const name = ref('')
const description = ref('')
const creating = ref(false)
const error = ref('')

const canSubmit = computed(() => name.value.trim().length > 0 && !creating.value)

async function submit() {
  if (!canSubmit.value) return
  creating.value = true
  error.value = ''
  try {
    const project = await store.createProject({
      name: name.value.trim(),
      description: description.value.trim(),
    })
    emit('created', project.id)
    emit('update:open', false)
    name.value = ''
    description.value = ''
    router.push(`/projects/${project.id}`)
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('projects.create_project') }}</DialogTitle>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <div class="grid gap-2">
          <Label for="project-name">{{ t('projects.project_name') }}</Label>
          <Input
            id="project-name"
            v-model="name"
            :placeholder="t('projects.project_name_placeholder')"
            @keyup.enter="submit()"
          />
        </div>
        <div class="grid gap-2">
          <Label for="project-desc">{{ t('projects.project_description') }}</Label>
          <Input
            id="project-desc"
            v-model="description"
            :placeholder="t('projects.project_description_placeholder')"
            @keyup.enter="submit()"
          />
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">{{ t('common.cancel') }}</Button>
        <Button :disabled="!canSubmit" :loading="creating" @click="submit()">
          {{ t('projects.create') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/ProjectCreateDialog.vue
git commit -m "feat(projects): add ProjectCreateDialog component"
```

---

### Task 8: ProjectList Component

**Files:**
- Create: `src/features/projects/components/ProjectList.vue`

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '../composables/useProjectStore'
import ProjectCreateDialog from './ProjectCreateDialog.vue'

const { t } = useI18n()
const router = useRouter()
const store = useProjectStore()
const showCreateDialog = ref(false)

onMounted(() => {
  store.loadProjects()
})

function openProject(id: string) {
  store.setCurrentProject(id)
  router.push(`/projects/${id}`)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b px-6 py-4">
      <h1 class="text-xl font-semibold">{{ t('sidebar.projects') }}</h1>
      <Button size="sm" @click="showCreateDialog = true">
        <Plus class="mr-1 h-4 w-4" />
        {{ t('projects.create_project') }}
      </Button>
    </div>

    <div v-if="store.loading" class="flex flex-1 items-center justify-center text-muted-foreground">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="store.projects.length === 0" class="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <p>{{ t('projects.empty') }}</p>
      <Button variant="outline" @click="showCreateDialog = true">
        {{ t('projects.create_first') }}
      </Button>
    </div>

    <div v-else class="grid flex-1 gap-4 overflow-auto p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <button
        v-for="project in store.projects"
        :key="project.id"
        class="flex h-40 flex-col justify-between rounded-xl border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
        @click="openProject(project.id)"
      >
        <div>
          <h3 class="font-semibold text-foreground">{{ project.name }}</h3>
          <p v-if="project.description" class="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {{ project.description }}
          </p>
        </div>
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{{ t('projects.template_' + project.template) }}</span>
          <span>·</span>
          <span>{{ new Date(project.updatedAt).toLocaleDateString() }}</span>
        </div>
      </button>
    </div>

    <ProjectCreateDialog v-model:open="showCreateDialog" />
  </div>
</template>
```

- [ ] **Step 2: Add i18n keys**

In `src/locales/zh.json`, add a `projects` section:

```json
"projects": {
  "create_project": "新建项目",
  "project_name": "项目名称",
  "project_name_placeholder": "输入项目名称",
  "project_description": "项目描述",
  "project_description_placeholder": "输入项目描述（可选）",
  "create": "创建项目",
  "empty": "暂无项目",
  "create_first": "创建第一个项目",
  "template_kanban": "看板",
  "template_scrum": "敏捷开发",
  "template_custom": "自定义"
}
```

In `src/locales/en.json`, add:

```json
"projects": {
  "create_project": "New Project",
  "project_name": "Project Name",
  "project_name_placeholder": "Enter project name",
  "project_description": "Description",
  "project_description_placeholder": "Enter description (optional)",
  "create": "Create Project",
  "empty": "No projects yet",
  "create_first": "Create your first project",
  "template_kanban": "Kanban",
  "template_scrum": "Scrum",
  "template_custom": "Custom"
}
```

- [ ] **Step 3: Add i18n keys for later tasks**

```json
// zh.json projects section additions:
"workflow": "工作流",
"custom_fields": "自定义字段",
"settings": "项目设置",
"view_board": "看板",
"view_list": "列表",
"view_gantt": "甘特图",
"create_task": "新建任务",
"task_title": "任务标题",
"task_title_placeholder": "输入任务标题",
"no_tasks": "此分栏暂无任务",
"priority_none": "无优先级",
"priority_low": "低",
"priority_medium": "中",
"priority_high": "高",
"priority_urgent": "紧急",
"type_task": "任务",
"type_bug": "缺陷",
"type_milestone": "里程碑",
"type_epic": "史诗",
"assignee": "负责人",
"due_date": "截止日期",
"status": "状态",
"no_status": "无状态",
"add_status": "添加状态",
"add_transition": "添加流转",
"transition_from": "从",
"transition_to": "到",
"transition_name": "操作名称（可选）",
"field_name": "字段名称",
"field_type": "字段类型",
"field_required": "必填",
"add_field": "添加字段",
"delete_project_confirm": "确定要删除此项目吗？此操作无法撤销。",
"delete_project": "删除项目",
```

```json
// en.json projects section additions:
"workflow": "Workflow",
"custom_fields": "Custom Fields",
"settings": "Project Settings",
"view_board": "Board",
"view_list": "List",
"view_gantt": "Gantt",
"create_task": "New Task",
"task_title": "Task Title",
"task_title_placeholder": "Enter task title",
"no_tasks": "No tasks in this column",
"priority_none": "No Priority",
"priority_low": "Low",
"priority_medium": "Medium",
"priority_high": "High",
"priority_urgent": "Urgent",
"type_task": "Task",
"type_bug": "Bug",
"type_milestone": "Milestone",
"type_epic": "Epic",
"assignee": "Assignee",
"due_date": "Due Date",
"status": "Status",
"no_status": "No status",
"add_status": "Add Status",
"add_transition": "Add Transition",
"transition_from": "From",
"transition_to": "To",
"transition_name": "Action name (optional)",
"field_name": "Field Name",
"field_type": "Field Type",
"field_required": "Required",
"add_field": "Add Field",
"delete_project_confirm": "Are you sure you want to delete this project? This action cannot be undone.",
"delete_project": "Delete Project",
```

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/components/ProjectList.vue src/locales/zh.json src/locales/en.json
git commit -m "feat(projects): add ProjectList component and full i18n keys"
```

---

### Task 9: ProjectsPage Route Entry

**Files:**
- Create: `src/features/projects/ProjectsPage.vue`
- Create: `src/features/projects/index.ts`

- [ ] **Step 1: Write ProjectsPage**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ProjectList from './components/ProjectList.vue'
import ProjectDetail from './components/ProjectDetail.vue'
import ProjectSettings from './components/ProjectSettings.vue'

const route = useRoute()
const { t } = useI18n()

const projectId = computed(() => route.params.projectId as string | undefined)
const showSettings = computed(() => route.path.endsWith('/settings'))

const pageTitle = computed(() => {
  if (showSettings.value) return t('projects.settings')
  if (projectId.value) return '' // ProjectDetail sets its own title
  return t('sidebar.projects')
})
</script>

<template>
  <div class="flex h-full flex-col">
    <ProjectSettings v-if="showSettings && projectId" :project-id="projectId" />
    <ProjectDetail v-else-if="projectId" :project-id="projectId" />
    <ProjectList v-else />
  </div>
</template>
```

- [ ] **Step 2: Write barrel export**

```typescript
// src/features/projects/index.ts
export { default as ProjectsPage } from './ProjectsPage.vue'
export { useProjectStore } from './composables/useProjectStore'
export { useWorkItemStore } from './composables/useWorkItemStore'
export { useWorkflow } from './composables/useWorkflow'
export { projectRepo } from './db/projectDb'
export * from './types'
```

- [ ] **Step 3: Commit**

```bash
git add src/features/projects/ProjectsPage.vue src/features/projects/index.ts
git commit -m "feat(projects): add ProjectsPage entry and barrel export"
```

---

## Phase 2: Core Work Items & Board View

### Task 10: ProjectDetail with View Switching

**Files:**
- Create: `src/features/projects/components/ProjectDetail.vue`

- [ ] **Step 1: Write ProjectDetail**

```vue
<script setup lang="ts">
import type { ProjectView } from '../types'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Kanban, LayoutList, Settings, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '../composables/useProjectStore'
import { useWorkItemStore } from '../composables/useWorkItemStore'
import BoardView from './view/BoardView.vue'
import ListView from './view/ListView.vue'
import GanttView from './view/GanttView.vue'

const props = defineProps<{ projectId: string }>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const itemStore = useWorkItemStore()

const project = computed(() =>
  projectStore.projects.find(p => p.id === props.projectId),
)

const currentView = computed<ProjectView>(() => {
  const v = route.query.view as string
  if (v === 'list' || v === 'gantt') return v
  return 'board'
})

onMounted(async () => {
  projectStore.setCurrentProject(props.projectId)
  itemStore.setCurrentProject(props.projectId)
  if (!project.value) await projectStore.loadProjects()
  await itemStore.loadItems(props.projectId)
})

function setView(view: ProjectView) {
  router.replace({ query: { view } })
}

function openSettings() {
  router.push(`/projects/${props.projectId}/settings`)
}

async function deleteProject() {
  if (!confirm(t('projects.delete_project_confirm'))) return
  await projectStore.deleteProject(props.projectId)
  router.push('/projects')
}
</script>

<template>
  <div v-if="project" class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b px-6 py-3">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold">{{ project.name }}</h1>
        <span class="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {{ t('projects.template_' + project.template) }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex rounded-lg border bg-muted/50 p-0.5">
          <button
            v-for="v in (['board', 'list', 'gantt'] as ProjectView[])"
            :key="v"
            class="rounded-md px-3 py-1.5 text-sm"
            :class="currentView === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            @click="setView(v)"
          >
            <Kanban v-if="v === 'board'" class="inline h-3.5 w-3.5" />
            <LayoutList v-else-if="v === 'list'" class="inline h-3.5 w-3.5" />
            <span v-else>{{ t('projects.view_gantt') }}</span>
            <span class="ml-1">{{ t('projects.view_' + v) }}</span>
          </button>
        </div>
        <Button variant="ghost" size="icon" @click="openSettings()">
          <Settings class="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" @click="deleteProject()">
          <Trash2 class="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>

    <div class="flex-1 overflow-hidden">
      <BoardView v-if="currentView === 'board'" :project-id="props.projectId" />
      <ListView v-else-if="currentView === 'list'" :project-id="props.projectId" />
      <GanttView v-else :project-id="props.projectId" />
    </div>
  </div>
  <div v-else class="flex flex-1 items-center justify-center">
    {{ t('common.loading') }}
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/ProjectDetail.vue
git commit -m "feat(projects): add ProjectDetail with view switching"
```

---

### Task 11: WorkItemCard Component

**Files:**
- Create: `src/features/projects/components/WorkItemCard.vue`

- [ ] **Step 1: Write WorkItemCard**

```vue
<script setup lang="ts">
import type { WorkItem } from '../types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarDays, User } from 'lucide-vue-next'
import { useWorkItemStore } from '../composables/useWorkItemStore'

const props = defineProps<{
  item: WorkItem
  isDragging?: boolean
}>()

const emit = defineEmits<{
  click: [item: WorkItem]
}>()

const { t } = useI18n()
const store = useWorkItemStore()

const priorityColor = computed(() => {
  const map: Record<string, string> = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
    none: 'bg-transparent',
  }
  return map[props.item.priority] ?? map.none
})

const isOverdue = computed(() => {
  if (!props.item.dueDate) return false
  return props.item.dueDate < Date.now() && props.item.status !== 'done'
})
</script>

<template>
  <div
    class="cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
    :class="{ 'opacity-50': isDragging }"
    @click="emit('click', item)"
  >
    <div class="mb-2 flex items-start gap-2">
      <div
        v-if="item.priority !== 'none'"
        class="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
        :class="priorityColor"
      />
      <span class="text-sm font-medium leading-snug">{{ item.title }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span class="rounded bg-muted px-1.5 py-0.5">
        {{ t('projects.type_' + item.type) }}
      </span>

      <span
        v-if="item.dueDate"
        class="inline-flex items-center gap-1"
        :class="{ 'text-destructive font-medium': isOverdue }"
      >
        <CalendarDays class="h-3 w-3" />
        {{ new Date(item.dueDate).toLocaleDateString() }}
      </span>

      <span v-if="item.assignee" class="inline-flex items-center gap-1">
        <User class="h-3 w-3" />
        {{ item.assignee.split(':')[0] }}
      </span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/WorkItemCard.vue
git commit -m "feat(projects): add WorkItemCard component with priority, due date, assignee"
```

---

### Task 12: BoardView (Kanban) with Drag-and-Drop

**Files:**
- Create: `src/features/projects/components/view/BoardView.vue`

- [ ] **Step 1: Write BoardView**

```vue
<script setup lang="ts">
import type { WorkflowStatus } from '../../types'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useWorkItemStore } from '../../composables/useWorkItemStore'
import { useWorkflow } from '../../composables/useWorkflow'
import WorkItemCard from '../WorkItemCard.vue'
import WorkItemCreateDialog from '../WorkItemCreateDialog.vue'
import WorkItemDetail from '../WorkItemDetail.vue'

const props = defineProps<{ projectId: string }>()

const { t } = useI18n()
const itemStore = useWorkItemStore()
const { loadWorkflow } = useWorkflow(() => props.projectId)

const statuses = ref<WorkflowStatus[]>([])
const showCreateDialog = ref(false)
const selectedItemId = ref<string | null>(null)
const createDefaultStatus = ref('')

onMounted(async () => {
  const wf = await loadWorkflow()
  statuses.value = wf.statuses
})

function itemsForStatus(statusKey: string) {
  return itemStore.currentItems.filter(i => i.status === statusKey)
}

function openCreate(statusKey: string) {
  createDefaultStatus.value = statusKey
  showCreateDialog.value = true
}

function onDragStart(event: DragEvent, itemId: string) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('text/plain', itemId)
  event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (!event.dataTransfer) return
  event.dataTransfer.dropEffect = 'move'
}

async function onDrop(event: DragEvent, targetStatus: string) {
  event.preventDefault()
  const itemId = event.dataTransfer?.getData('text/plain')
  if (!itemId) return
  const items = itemsForStatus(targetStatus)
  const newOrder = items.length > 0 ? Math.max(...items.map(i => i.order)) + 1 : 0
  await itemStore.reorderItem(itemId, props.projectId, newOrder, targetStatus)
}
</script>

<template>
  <div class="flex h-full gap-3 overflow-x-auto p-4">
    <div
      v-for="status in statuses"
      :key="status.key"
      class="flex w-72 shrink-0 flex-col rounded-lg bg-muted/50"
      @dragover="onDragOver"
      @drop="onDrop($event, status.key)"
    >
      <div class="flex items-center justify-between px-3 py-2.5">
        <div class="flex items-center gap-2">
          <div
            class="h-2.5 w-2.5 rounded-full"
            :style="{ backgroundColor: status.color }"
          />
          <span class="text-sm font-medium">{{ status.name }}</span>
          <span class="text-xs text-muted-foreground">{{ itemsForStatus(status.key).length }}</span>
        </div>
        <Button variant="ghost" size="icon" class="h-6 w-6" @click="openCreate(status.key)">
          <Plus class="h-3.5 w-3.5" />
        </Button>
      </div>

      <div class="flex flex-col gap-2 overflow-y-auto px-2 pb-2">
        <WorkItemCard
          v-for="item in itemsForStatus(status.key)"
          :key="item.id"
          :item="item"
          draggable="true"
          @dragstart="onDragStart($event, item.id)"
          @click="selectedItemId = item.id"
        />
        <p
          v-if="itemsForStatus(status.key).length === 0"
          class="py-6 text-center text-xs text-muted-foreground"
        >
          {{ t('projects.no_tasks') }}
        </p>
      </div>
    </div>

    <WorkItemCreateDialog
      v-model:open="showCreateDialog"
      :project-id="props.projectId"
      :default-status="createDefaultStatus"
    />
    <WorkItemDetail
      v-if="selectedItemId"
      :item-id="selectedItemId"
      @close="selectedItemId = null"
    />
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/view/BoardView.vue
git commit -m "feat(projects): add Kanban BoardView with drag-and-drop"
```

---

### Task 13: WorkItemCreateDialog

**Files:**
- Create: `src/features/projects/components/WorkItemCreateDialog.vue`

- [ ] **Step 1: Write WorkItemCreateDialog**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@muon/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@muon/ui/dialog'
import { Input } from '@muon/ui/input'
import { Label } from '@muon/ui/label'
import { Textarea } from '@muon/ui/textarea'
import { useWorkItemStore } from '../composables/useWorkItemStore'

const props = defineProps<{
  open: boolean
  projectId: string
  defaultStatus: string
  initialTitle?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'created': []
}>()

const { t } = useI18n()
const store = useWorkItemStore()

const title = ref(props.initialTitle ?? '')
const description = ref('')
const creating = ref(false)

const canSubmit = computed(() => title.value.trim().length > 0 && !creating.value)

async function submit() {
  if (!canSubmit.value) return
  creating.value = true
  try {
    await store.createItem(props.projectId, {
      title: title.value.trim(),
      description: description.value.trim(),
      status: props.defaultStatus,
    })
    emit('created')
    emit('update:open', false)
    title.value = ''
    description.value = ''
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('projects.create_task') }}</DialogTitle>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <div class="grid gap-2">
          <Label for="task-title">{{ t('projects.task_title') }}</Label>
          <Input
            id="task-title"
            v-model="title"
            :placeholder="t('projects.task_title_placeholder')"
            @keyup.enter="submit()"
          />
        </div>
        <div class="grid gap-2">
          <Label for="task-desc">{{ t('projects.project_description') }}</Label>
          <Textarea
            id="task-desc"
            v-model="description"
            rows="3"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          {{ t('common.cancel') }}
        </Button>
        <Button :disabled="!canSubmit" :loading="creating" @click="submit()">
          {{ t('common.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/WorkItemCreateDialog.vue
git commit -m "feat(projects): add WorkItemCreateDialog component"
```

---

### Task 14: WorkItemDetail Panel

**Files:**
- Create: `src/features/projects/components/WorkItemDetail.vue`

- [ ] **Step 1: Write WorkItemDetail**

```vue
<script setup lang="ts">
import type { Priority, WorkItemType } from '../types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarDays, Trash2, User, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@muon/ui/select'
import { Textarea } from '@muon/ui/textarea'
import { projectRepo } from '../db/projectDb'
import { useWorkItemStore } from '../composables/useWorkItemStore'
import { useWorkflow } from '../composables/useWorkflow'

const props = defineProps<{
  itemId: string
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const store = useWorkItemStore()
const item = computed(() => store.currentItems.find(i => i.id === props.itemId))

const { loadWorkflow, getAvailableTransitions, changeStatus } = useWorkflow(
  () => item.value?.projectId ?? '',
)

const availableTransitions = ref<string[]>([])
const editing = ref(false)
const editTitle = ref('')
const editDescription = ref('')

watch(() => props.itemId, async () => {
  if (!item.value) return
  const wf = await loadWorkflow()
  availableTransitions.value = getAvailableTransitions(wf, item.value.status)
  editTitle.value = item.value.title
  editDescription.value = item.value.description
}, { immediate: true })

async function handleSave() {
  if (!item.value) return
  await store.updateItem(item.value.id, {
    title: editTitle.value,
    description: editDescription.value,
  })
  editing.value = false
}

async function handleTransition(toStatus: string) {
  await changeStatus(props.itemId, toStatus)
}

async function handleDelete() {
  if (!item.value) return
  await store.deleteItem(item.value.id, item.value.projectId)
  emit('close')
}

const priorityOptions: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']
const typeOptions: WorkItemType[] = ['task', 'bug', 'milestone', 'epic']
</script>

<template>
  <div v-if="item" class="fixed inset-y-0 right-0 z-40 w-96 border-l bg-background shadow-xl">
    <div class="flex items-center justify-between border-b px-4 py-3">
      <h2 class="font-semibold">{{ t('projects.task_title') }}</h2>
      <Button variant="ghost" size="icon" @click="emit('close')">
        <X class="h-4 w-4" />
      </Button>
    </div>

    <div class="flex flex-col gap-4 overflow-y-auto p-4">
      <!-- Title -->
      <div v-if="editing" class="grid gap-2">
        <Label>{{ t('projects.task_title') }}</Label>
        <Input v-model="editTitle" />
        <Label>{{ t('projects.project_description') }}</Label>
        <Textarea v-model="editDescription" rows="4" />
        <div class="flex gap-2">
          <Button size="sm" @click="handleSave()">{{ t('common.save') }}</Button>
          <Button size="sm" variant="outline" @click="editing = false">{{ t('common.cancel') }}</Button>
        </div>
      </div>
      <div v-else>
        <h3 class="text-lg font-medium" @dblclick="editing = true">{{ item.title }}</h3>
        <p v-if="item.description" class="mt-2 text-sm text-muted-foreground">{{ item.description }}</p>
        <Button variant="ghost" size="sm" class="mt-1" @click="editing = true">{{ t('common.edit') }}</Button>
      </div>

      <!-- Priority -->
      <div class="grid gap-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('projects.priority_' + item.priority) ? '' : t('assignee') }}</Label>
        <Select
          :model-value="item.priority"
          @update:model-value="(v: Priority) => store.updateItem(item.id, { priority: v })"
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="p in priorityOptions" :key="p" :value="p">
              {{ t(`projects.priority_${p}`) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Type -->
      <div class="grid gap-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('projects.type_task') }}</Label>
        <Select
          :model-value="item.type"
          @update:model-value="(v: WorkItemType) => store.updateItem(item.id, { type: v })"
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="tp in typeOptions" :key="tp" :value="tp">
              {{ t(`projects.type_${tp}`) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Due Date -->
      <div class="grid gap-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('projects.due_date') }}</Label>
        <Input
          type="date"
          :model-value="item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : ''"
          @update:model-value="(v: string) => store.updateItem(item.id, { dueDate: v ? new Date(v).getTime() : undefined })"
        />
      </div>

      <!-- Transitions -->
      <div v-if="availableTransitions.length > 0" class="grid gap-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('projects.status') }}</Label>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="tStatus in availableTransitions"
            :key="tStatus"
            size="sm"
            variant="outline"
            @click="handleTransition(tStatus)"
          >
            {{ tStatus }}
          </Button>
        </div>
      </div>

      <!-- Delete -->
      <Button variant="destructive" size="sm" @click="handleDelete()">
        <Trash2 class="mr-1 h-3.5 w-3.5" />
        {{ t('common.delete') }}
      </Button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/WorkItemDetail.vue
git commit -m "feat(projects): add WorkItemDetail side panel with editing"
```

---

### Task 15: ListView (Table)

**Files:**
- Create: `src/features/projects/components/view/ListView.vue`

- [ ] **Step 1: Write ListView**

```vue
<script setup lang="ts">
import type { Priority, WorkItem } from '../../types'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useWorkItemStore } from '../../composables/useWorkItemStore'
import WorkItemCreateDialog from '../WorkItemCreateDialog.vue'

const props = defineProps<{ projectId: string }>()

const { t } = useI18n()
const store = useWorkItemStore()

const sortBy = ref<'priority' | 'dueDate' | 'createdAt' | 'title'>('createdAt')
const sortDir = ref<'asc' | 'desc'>('desc')
const showCreateDialog = ref(false)

const priorityOrder: Record<Priority, number> = {
  urgent: 0, high: 1, medium: 2, low: 3, none: 4,
}

const sortedItems = computed(() => {
  const items = [...store.currentItems]
  items.sort((a, b) => {
    let cmp = 0
    if (sortBy.value === 'priority') {
      cmp = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
    }
    else if (sortBy.value === 'dueDate') {
      cmp = (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity)
    }
    else if (sortBy.value === 'title') {
      cmp = a.title.localeCompare(b.title)
    }
    else {
      cmp = a.createdAt - b.createdAt
    }
    return sortDir.value === 'desc' ? -cmp : cmp
  })
  return items
})

function toggleSort(field: typeof sortBy.value) {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortBy.value = field
    sortDir.value = 'asc'
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center border-b px-4 py-2">
      <Button size="sm" @click="showCreateDialog = true">
        <Plus class="mr-1 h-3.5 w-3.5" />
        {{ t('projects.create_task') }}
      </Button>
    </div>

    <div class="flex-1 overflow-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b text-left text-xs text-muted-foreground">
            <th class="cursor-pointer px-4 py-2 font-medium" @click="toggleSort('title')">
              {{ t('projects.task_title') }}
              <ArrowUp v-if="sortBy === 'title' && sortDir === 'asc'" class="inline h-3 w-3" />
              <ArrowDown v-else-if="sortBy === 'title'" class="inline h-3 w-3" />
            </th>
            <th class="cursor-pointer px-4 py-2 font-medium" @click="toggleSort('priority')">
              {{ t('assignee') }}
            </th>
            <th class="cursor-pointer px-4 py-2 font-medium" @click="toggleSort('dueDate')">
              {{ t('projects.due_date') }}
            </th>
            <th class="px-4 py-2 font-medium">{{ t('projects.status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in sortedItems"
            :key="item.id"
            class="border-b text-sm hover:bg-muted/50"
          >
            <td class="px-4 py-2.5">
              <div class="flex items-center gap-2">
                <span v-if="item.priority !== 'none'" class="text-xs text-muted-foreground">
                  {{ t('projects.priority_' + item.priority) }}
                </span>
                <span class="font-medium">{{ item.title }}</span>
              </div>
            </td>
            <td class="px-4 py-2.5 text-muted-foreground">
              {{ item.assignee ? item.assignee.split(':')[0] : '-' }}
            </td>
            <td class="px-4 py-2.5 text-muted-foreground">
              {{ item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-' }}
            </td>
            <td class="px-4 py-2.5">
              <span class="rounded bg-muted px-2 py-0.5 text-xs">{{ item.status }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="sortedItems.length === 0" class="py-12 text-center text-muted-foreground">
        {{ t('projects.no_tasks') }}
      </p>
    </div>

    <WorkItemCreateDialog
      v-model:open="showCreateDialog"
      :project-id="props.projectId"
      default-status="todo"
    />
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/view/ListView.vue
git commit -m "feat(projects): add ListView with sortable columns"
```

---

## Phase 3: Workflow & Custom Fields

### Task 16: WorkflowEditor Component

**Files:**
- Create: `src/features/projects/components/settings/WorkflowEditor.vue`

- [ ] **Step 1: Write WorkflowEditor**

```vue
<script setup lang="ts">
import type { Workflow } from '../../types'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWorkflow } from '../../composables/useWorkflow'

const props = defineProps<{ projectId: string }>()

const { t } = useI18n()
const { loadWorkflow, saveWorkflow, DEFAULT_WORKFLOW } = useWorkflow(() => props.projectId)
const workflow = ref<Workflow | null>(null)
const saving = ref(false)

onMounted(async () => {
  workflow.value = await loadWorkflow()
})

async function addStatus() {
  if (!workflow.value) return
  workflow.value.statuses.push({
    key: `status_${workflow.value.statuses.length + 1}`,
    name: 'New Status',
    color: '#e5e7eb',
    category: 'todo',
  })
}

async function removeStatus(index: number) {
  if (!workflow.value) return
  workflow.value.statuses.splice(index, 1)
}

async function addTransition() {
  if (!workflow.value || workflow.value.statuses.length < 2) return
  workflow.value.transitions.push({
    from: workflow.value.statuses[0].key,
    to: workflow.value.statuses[1].key,
    name: '',
  })
}

async function removeTransition(index: number) {
  if (!workflow.value) return
  workflow.value.transitions.splice(index, 1)
}

async function handleSave() {
  if (!workflow.value) return
  saving.value = true
  try {
    await saveWorkflow(workflow.value)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6 p-6" v-if="workflow">
    <!-- Statuses -->
    <div>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-medium">{{ t('projects.status') }}</h3>
        <Button size="sm" variant="outline" @click="addStatus()">
          <Plus class="mr-1 h-3.5 w-3.5" /> {{ t('projects.add_status') }}
        </Button>
      </div>
      <div class="space-y-2">
        <div
          v-for="(status, i) in workflow.statuses"
          :key="i"
          class="flex items-center gap-2"
        >
          <Input
            v-model="status.key"
            class="w-32"
            placeholder="Key"
          />
          <Input
            v-model="status.name"
            class="w-40"
            placeholder="Name"
          />
          <Input
            v-model="status.color"
            type="color"
            class="w-12 p-1"
          />
          <Button variant="ghost" size="icon" @click="removeStatus(i)">
            <Trash2 class="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Transitions -->
    <div>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-medium">{{ t('projects.workflow') }}</h3>
        <Button
          size="sm"
          variant="outline"
          :disabled="workflow.statuses.length < 2"
          @click="addTransition()"
        >
          <Plus class="mr-1 h-3.5 w-3.5" /> {{ t('projects.add_transition') }}
        </Button>
      </div>
      <div class="space-y-2">
        <div
          v-for="(tr, i) in workflow.transitions"
          :key="i"
          class="flex items-center gap-2"
        >
          <select
            v-model="tr.from"
            class="rounded border bg-background px-2 py-1.5 text-sm"
          >
            <option v-for="s in workflow.statuses" :key="s.key" :value="s.key">
              {{ s.name }}
            </option>
          </select>
          <span class="text-muted-foreground">→</span>
          <select
            v-model="tr.to"
            class="rounded border bg-background px-2 py-1.5 text-sm"
          >
            <option v-for="s in workflow.statuses" :key="s.key" :value="s.key">
              {{ s.name }}
            </option>
          </select>
          <Input
            v-model="tr.name"
            class="w-32"
            :placeholder="t('projects.transition_name')"
          />
          <Button variant="ghost" size="icon" @click="removeTransition(i)">
            <Trash2 class="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>

    <Button :loading="saving" @click="handleSave()">{{ t('common.save') }}</Button>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/settings/WorkflowEditor.vue
git commit -m "feat(projects): add WorkflowEditor for status and transition management"
```

---

### Task 17: CustomFieldEditor Component

**Files:**
- Create: `src/features/projects/components/settings/CustomFieldEditor.vue`

- [ ] **Step 1: Write CustomFieldEditor**

```vue
<script setup lang="ts">
import type { CustomField } from '../../types'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { projectRepo } from '../../db/projectDb'

const props = defineProps<{ projectId: string }>()

const { t } = useI18n()
const fields = ref<CustomField[]>([])

onMounted(async () => {
  fields.value = await projectRepo.listCustomFields(props.projectId)
})

async function addField() {
  const field: CustomField = {
    id: crypto.randomUUID(),
    projectId: props.projectId,
    name: '',
    type: 'text',
    required: false,
    order: fields.value.length,
  }
  await projectRepo.saveCustomField(field)
  fields.value.push(field)
}

async function removeField(id: string) {
  await projectRepo.deleteCustomField(id)
  fields.value = fields.value.filter(f => f.id !== id)
}

async function saveField(field: CustomField) {
  await projectRepo.saveCustomField(field)
}
</script>

<template>
  <div class="space-y-4 p-6">
    <div class="flex items-center justify-between">
      <h3 class="font-medium">{{ t('projects.custom_fields') }}</h3>
      <Button size="sm" variant="outline" @click="addField()">
        <Plus class="mr-1 h-3.5 w-3.5" /> {{ t('projects.add_field') }}
      </Button>
    </div>

    <div v-if="fields.length === 0" class="py-6 text-center text-sm text-muted-foreground">
      {{ t('projects.no_tasks') }}
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="field in fields"
        :key="field.id"
        class="flex items-center gap-2"
      >
        <Input
          v-model="field.name"
          class="w-44"
          :placeholder="t('projects.field_name')"
          @blur="saveField(field)"
        />
        <select
          v-model="field.type"
          class="rounded border bg-background px-2 py-1.5 text-sm"
          @change="saveField(field)"
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="select">Select</option>
          <option value="multiSelect">Multi-select</option>
          <option value="date">Date</option>
          <option value="user">User</option>
          <option value="url">URL</option>
        </select>
        <label class="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            :checked="field.required"
            @change="field.required = !field.required; saveField(field)"
          />
          {{ t('projects.field_required') }}
        </label>
        <Button variant="ghost" size="icon" @click="removeField(field.id)">
          <Trash2 class="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/settings/CustomFieldEditor.vue
git commit -m "feat(projects): add CustomFieldEditor for field definitions"
```

---

### Task 18: ProjectSettings Page

**Files:**
- Create: `src/features/projects/components/ProjectSettings.vue`

- [ ] **Step 1: Write ProjectSettings**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '../composables/useProjectStore'
import WorkflowEditor from './settings/WorkflowEditor.vue'
import CustomFieldEditor from './settings/CustomFieldEditor.vue'
import ProjectCreateDialog from './ProjectCreateDialog.vue'

const props = defineProps<{ projectId: string }>()

const { t } = useI18n()
const router = useRouter()
const store = useProjectStore()
const project = computed(() => store.projects.find(p => p.id === props.projectId))

const activeTab = ref<'general' | 'workflow' | 'fields'>('general')
const showEditDialog = ref(false)

function goBack() {
  router.push(`/projects/${props.projectId}`)
}
</script>

<template>
  <div v-if="project" class="flex h-full flex-col">
    <div class="flex items-center gap-3 border-b px-6 py-3">
      <Button variant="ghost" size="icon" @click="goBack()">
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <h1 class="text-lg font-semibold">{{ project.name }} — {{ t('projects.settings') }}</h1>
    </div>

    <div class="flex border-b">
      <button
        v-for="tab in (['general', 'workflow', 'fields'] as const)"
        :key="tab"
        class="border-b-2 px-4 py-2 text-sm font-medium"
        :class="activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'"
        @click="activeTab = tab"
      >
        {{ tab === 'general' ? t('common.edit') : t(`projects.${tab === 'workflow' ? 'workflow' : 'custom_fields'}`) }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="activeTab === 'general'" class="max-w-md space-y-4 p-6">
        <p class="text-sm text-muted-foreground">
          {{ t('projects.create_project') }} — {{ t('projects.project_name') }}: {{ project.name }}
        </p>
        <Button variant="outline" @click="showEditDialog = true">
          {{ t('common.edit') }}
        </Button>
      </div>
      <WorkflowEditor v-else-if="activeTab === 'workflow'" :project-id="projectId" />
      <CustomFieldEditor v-else :project-id="projectId" />
    </div>

    <ProjectCreateDialog v-model:open="showEditDialog" />
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/ProjectSettings.vue
git commit -m "feat(projects): add ProjectSettings with workflow and field tabs"
```

---

## Phase 4: Gantt View & Module Integrations

### Task 19: GanttView Component

**Files:**
- Create: `src/features/projects/components/view/GanttView.vue`

- [ ] **Step 1: Write GanttView**

```vue
<script setup lang="ts">
import type { WorkItem } from '../../types'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkItemStore } from '../../composables/useWorkItemStore'

const props = defineProps<{ projectId: string }>()

const { t } = useI18n()
const store = useWorkItemStore()
const monthsBack = ref(1)
const monthsForward = ref(3)

const itemsWithDates = computed(() =>
  store.currentItems.filter(i => i.dueDate).sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0)),
)

const range = computed(() => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack.value, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + monthsForward.value + 1, 0)
  const days: Date[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }
  return { start, end, days }
})

function dateToColumnX(dateMs: number): number {
  const msPerDay = 86_400_000
  return Math.round((dateMs - range.value.start.getTime()) / msPerDay)
}

const todayX = computed(() => dateToColumnX(Date.now()))

function totalDays(): number {
  return Math.round((range.value.end.getTime() - range.value.start.getTime()) / 86_400_000) + 1
}

const dayLabels = computed(() => {
  const months = new Map<string, number>()
  for (const d of range.value.days) {
    const key = `${d.getFullYear()}-${d.getMonth()}`
    months.set(key, (months.get(key) ?? 0) + 1)
  }
  // return first day of each month and its span
  const result: { label: string, span: number }[] = []
  let lastKey = ''
  for (const d of range.value.days) {
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (key !== lastKey) {
      result.push({ label: `${d.getMonth() + 1}月`, span: months.get(key)! })
      lastKey = key
    }
  }
  return result
})

const columnWidth = 24 // px per day
</script>

<template>
  <div class="flex h-full flex-col overflow-auto">
    <div v-if="itemsWithDates.length === 0" class="flex flex-1 items-center justify-center text-muted-foreground">
      {{ t('projects.no_tasks') }}
    </div>

    <div v-else class="flex flex-1 flex-col" :style="{ width: totalDays() * columnWidth + 'px' }">
      <!-- Month header -->
      <div class="flex border-b bg-muted/50 text-xs">
        <div class="w-64 shrink-0 px-3 py-2 font-medium">{{ t('projects.task_title') }}</div>
        <div class="flex">
          <div
            v-for="(m, i) in dayLabels"
            :key="i"
            class="border-r px-2 py-2 text-center font-medium"
            :style="{ width: m.span * columnWidth + 'px' }"
          >
            {{ m.label }}
          </div>
        </div>
      </div>

      <!-- Items -->
      <div
        v-for="item in itemsWithDates"
        :key="item.id"
        class="flex border-b text-sm hover:bg-muted/50"
      >
        <div class="w-64 shrink-0 truncate px-3 py-2.5">{{ item.title }}</div>
        <div class="relative flex-1">
          <div
            class="absolute top-1.5 h-6 rounded bg-primary/80 px-2 text-xs leading-6 text-primary-foreground"
            :style="{ left: dateToColumnX(item.dueDate!) * columnWidth + 'px' }"
          >
            {{ new Date(item.dueDate!).toLocaleDateString() }}
          </div>
          <!-- Today line -->
          <div
            class="absolute top-0 h-full w-px bg-red-500"
            :style="{ left: todayX * columnWidth + 'px' }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/components/view/GanttView.vue
git commit -m "feat(projects): add GanttView timeline component"
```

---

### Task 20: Chat-to-Task Integration

**Files:**
- Modify: `src/features/chat/components/MessageActionBar.vue`
- Modify: `src/locales/zh.json:365-370`
- Modify: `src/locales/en.json:365-370`

- [ ] **Step 1: Add "convert to task" action in MessageActionBar**

Find the action buttons section in `MessageActionBar.vue` and add a new button. The exact integration point depends on the current structure. The button emits a new event:

```typescript
// In MessageActionBar.vue script section:
const emit = defineEmits<{
  // ... existing emits
  'convert-to-task': [messageText: string]
}>()
```

In the template, add a button after the existing action buttons:

```vue
<!-- Add in the action buttons area -->
<ActionItem
  :label="t('chat.convert_to_task')"
  @click="emit('convert-to-task', extractedText)"
/>
```

- [ ] **Step 2: Wire up in consuming component**

The consuming component (ChatMessage or ChatPage) listens for `convert-to-task` and opens the WorkItemCreateDialog:

```typescript
// In the parent component:
const showTaskDialog = ref(false)
const taskTitle = ref('')

function handleConvertToTask(text: string) {
  taskTitle.value = text.slice(0, 200) // first 200 chars as title
  showTaskDialog.value = true
}
```

- [ ] **Step 3: Add i18n key**

In `zh.json` chat section: `"convert_to_task": "转为任务"`
In `en.json` chat section: `"convert_to_task": "Convert to Task"`

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/components/MessageActionBar.vue src/locales/zh.json src/locales/en.json
git commit -m "feat(projects): add chat-to-task conversion integration"
```

---

### Task 21: Calendar Integration

**Files:**
- Modify: `src/features/calendar/components/CalendarPage.vue`

- [ ] **Step 1: Query work items with due dates**

In `CalendarPage.vue`, add a source that loads work items from Dexie:

```typescript
import { projectRepo } from '@/features/projects/db/projectDb'

async function loadProjectTasks(): Promise<Array<{ date: Date; title: string; projectId: string }>> {
  // Get all projects, then collect their work items with due dates
  const projects = await projectRepo.listProjects()
  const results: Array<{ date: Date; title: string; projectId: string }> = []
  for (const p of projects) {
    const items = await projectRepo.listWorkItems(p.id)
    for (const item of items) {
      if (item.dueDate) {
        results.push({ date: new Date(item.dueDate), title: item.title, projectId: p.id })
      }
    }
  }
  return results
}
```

Render work item due dates as additional calendar events with a project indicator.

- [ ] **Step 2: Commit**

```bash
git add src/features/calendar/components/CalendarPage.vue
git commit -m "feat(projects): integrate work item due dates with calendar"
```

---

## Appendix: i18n Keys Summary

All i18n keys that need to be added across tasks. Ensure these are all present in both `zh.json` and `en.json` by the end of implementation.

| Key | zh | en |
|---|---|---|
| `sidebar.projects` | 项目 | Projects |
| `projects.create_project` | 新建项目 | New Project |
| `projects.project_name` | 项目名称 | Project Name |
| `projects.project_name_placeholder` | 输入项目名称 | Enter project name |
| `projects.project_description` | 项目描述 | Description |
| `projects.project_description_placeholder` | 输入项目描述（可选） | Enter description (optional) |
| `projects.create` | 创建项目 | Create Project |
| `projects.empty` | 暂无项目 | No projects yet |
| `projects.create_first` | 创建第一个项目 | Create your first project |
| `projects.template_kanban` | 看板 | Kanban |
| `projects.template_scrum` | 敏捷开发 | Scrum |
| `projects.template_custom` | 自定义 | Custom |
| `projects.workflow` | 工作流 | Workflow |
| `projects.custom_fields` | 自定义字段 | Custom Fields |
| `projects.settings` | 项目设置 | Project Settings |
| `projects.view_board` | 看板 | Board |
| `projects.view_list` | 列表 | List |
| `projects.view_gantt` | 甘特图 | Gantt |
| `projects.create_task` | 新建任务 | New Task |
| `projects.task_title` | 任务标题 | Task Title |
| `projects.task_title_placeholder` | 输入任务标题 | Enter task title |
| `projects.no_tasks` | 此分栏暂无任务 | No tasks in this column |
| `projects.priority_none` | 无优先级 | No Priority |
| `projects.priority_low` | 低 | Low |
| `projects.priority_medium` | 中 | Medium |
| `projects.priority_high` | 高 | High |
| `projects.priority_urgent` | 紧急 | Urgent |
| `projects.type_task` | 任务 | Task |
| `projects.type_bug` | 缺陷 | Bug |
| `projects.type_milestone` | 里程碑 | Milestone |
| `projects.type_epic` | 史诗 | Epic |
| `projects.status` | 状态 | Status |
| `projects.assignee` | 负责人 | Assignee |
| `projects.due_date` | 截止日期 | Due Date |
| `projects.add_status` | 添加状态 | Add Status |
| `projects.add_transition` | 添加流转 | Add Transition |
| `projects.transition_name` | 操作名称（可选） | Action name (optional) |
| `projects.field_name` | 字段名称 | Field Name |
| `projects.field_type` | 字段类型 | Field Type |
| `projects.field_required` | 必填 | Required |
| `projects.add_field` | 添加字段 | Add Field |
| `projects.delete_project_confirm` | 确定要删除此项目吗？此操作无法撤销。 | Delete confirm |
| `projects.delete_project` | 删除项目 | Delete Project |
| `chat.convert_to_task` | 转为任务 | Convert to Task |

---

## Test Plan

Each task pair in Phases 1-3 should have accompanying tests:

1. **Types:** Zod schema validation (valid/invalid inputs)
2. **projectDb:** Dexie CRUD operations (mock with fake-indexeddb)
3. **Matrix sync:** Event parsing and sending (mock Matrix client)
4. **Stores:** Pinia store actions and state reactors
5. **useWorkflow:** State machine transition logic
6. **Components:** Mount tests for dialogs, lists, views (Vue Test Utils)
7. **Integrations:** Chat → task, calendar → work items

---

## Known Follow-ups (Post Phase 4)

- **Docs → Project linking:** Add project selector to DocsPage, display linked docs in ProjectDetail
- **Approvals → WorkItem:** Trigger approval flow from WorkItemDetail, auto-transition status on approval result
- **Cross-device sync conflict UI:** Surface merge conflicts when two devices edit the same work item concurrently
- **Project templates:** Pre-built workflow + custom field templates for common use cases (bug tracker, sprint planning)
