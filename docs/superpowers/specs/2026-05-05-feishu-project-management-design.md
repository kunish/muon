# Feishu Project Management — Design Spec

**Date:** 2026-05-05
**Status:** Approved
**Scope:** New feature — project management module aligned with Feishu Project (project.feishu.cn)

---

## Architecture Decision

**Hybrid Matrix + Dexie (Approach C):**

- **Project metadata** → Matrix Room state events (permissions, notifications, chat integration)
- **Work items, workflows, custom fields** → Dexie (IndexedDB) for high-performance CRUD and complex queries
- **Cross-device sync** → Custom Matrix timeline messages with last-write-wins field-level merging

### Why not pure Matrix?

Matrix state events are not designed for high-frequency structured data mutations (work item reordering, field editing). Complex cross-project queries would require client-side processing.

### Why not pure Dexie?

Would lose Matrix's real-time sync, E2E encryption, room-based auth model, and natural chat integration.

---

## Data Model

### Project (Matrix Room state event)

```
{
  id: string              // = Matrix roomId
  name: string
  description: string
  icon: string
  color: string
  visibility: 'private' | 'team' | 'public'
  template: 'kanban' | 'scrum' | 'custom'
  createdBy: string       // Matrix userId
  createdAt: number
  updatedAt: number
}
```

### WorkItem (Dexie table)

```
{
  id: string              // uuid
  projectId: string       // → Project.id
  parentId?: string       // subtask parent → WorkItem.id
  type: 'task' | 'bug' | 'milestone' | 'epic'
  title: string
  description: string     // TipTap rich text JSON
  status: string          // references workflow status key
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  assignee?: string       // Matrix userId
  dueDate?: number
  order: number           // drag-and-drop ordering
  customFields: Record<string, unknown>
  chatRoomId?: string     // linked discussion channel
  linkedDecisions: string[]
  createdAt: number
  updatedAt: number
}
```

### Workflow (Dexie table, per project)

```
{
  id: string
  projectId: string
  statuses: { key, name, color, category }[]
  transitions: { from, to, name? }[]
}
```

### CustomField (Dexie table, per project)

```
{
  id: string
  projectId: string
  name: string
  type: 'text' | 'number' | 'select' | 'multiSelect' | 'date' | 'user' | 'url'
  options?: string[]
  required: boolean
  order: number
}
```

---

## Directory Structure

```
src/features/projects/
├── components/
│   ├── ProjectList.vue
│   ├── ProjectCreateDialog.vue
│   ├── ProjectDetail.vue
│   ├── ProjectSettings.vue
│   ├── WorkItemCard.vue
│   ├── WorkItemCreateDialog.vue
│   ├── WorkItemDetail.vue
│   ├── WorkItemRow.vue
│   ├── view/
│   │   ├── BoardView.vue
│   │   ├── ListView.vue
│   │   └── GanttView.vue
│   └── settings/
│       ├── WorkflowEditor.vue
│       └── CustomFieldEditor.vue
├── composables/
│   ├── useProjectStore.ts
│   ├── useWorkItemStore.ts
│   ├── useWorkflow.ts
│   └── useProjectSync.ts
├── db/
│   └── projectDb.ts
├── types/
│   └── index.ts
├── ProjectsPage.vue
└── index.ts
```

---

## Routes

```
/projects                          → ProjectList.vue
/projects/:projectId               → ProjectDetail.vue (default: board view)
/projects/:projectId?view=board   → BoardView
/projects/:projectId?view=list    → ListView
/projects/:projectId?view=gantt   → GanttView
/projects/:projectId/settings     → ProjectSettings.vue
```

---

## Data Flow

### Single-device primary path

```
Component → Pinia Store → Dexie → Pinia Store (reactive) → Component
```

### Cross-device sync

```
Device A: write Dexie → send Matrix custom event to project Room
Device B: receive Matrix event → compare timestamp → merge to Dexie → Pinia reactive update
```

Matrix sync message types:

```
muon.project.workitem.create
muon.project.workitem.update
muon.project.workitem.delete
muon.project.workitem.reorder
muon.project.workflow.update
muon.project.field.update
```

### Conflict resolution

Last-write-wins at field granularity. Each update message carries `{workItemId, changedFields, timestamp}`. The receiver compares timestamps per-field and picks the latest.

---

## Module Integrations

| Source Module | Integration | Destination |
|---|---|---|
| Chat (MessageActionBar) | "转为任务" button | WorkItem creation with pre-filled title |
| WorkItem detail | Set dueDate → Calendar | CalendarPage renders work items |
| WorkItem detail | "发起审批" → Approvals | Approval flow updates work item status |
| Docs page | "关联项目" | Project detail shows linked docs |
| Organization | Member picker | Assignee selection for work items |

---

## Sidebar Entry

New "项目" entry in workspace rail, alongside existing modules (calendar, docs, email, approvals, calls).

---

## Implementation Phases

### Phase 1: Foundation
- `projectDb.ts` — Dexie schema
- `types/index.ts` — all type definitions
- `useProjectStore.ts` + `useWorkItemStore.ts`
- Matrix sync protocol (`muon.project.*` events) in `src/matrix/`
- `ProjectsPage.vue` + `ProjectList.vue` + `ProjectCreateDialog.vue`

### Phase 2: Core Work Items
- `WorkItemCard.vue` + `WorkItemCreateDialog.vue` + `WorkItemDetail.vue`
- `BoardView.vue` (Kanban with drag-and-drop)
- `ListView.vue` (table with sort/filter)

### Phase 3: Workflow & Fields
- `WorkflowEditor.vue` — status & transition editor
- `CustomFieldEditor.vue` — field definitions
- `useWorkflow.ts` — state machine
- Custom field rendering in card and detail views

### Phase 4: Views & Integration
- `GanttView.vue` — timeline/gantt chart
- Chat → task conversion
- Calendar integration (work item due dates)
- Docs → project linking
- Approvals integration
