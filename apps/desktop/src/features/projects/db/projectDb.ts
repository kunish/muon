import type { EntityTable } from 'dexie'
import type { CustomField, Project, Workflow, WorkItem } from '../types'
import type { DesktopEffect } from '@/shared/lib/effect'
import Dexie from 'dexie'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { customFieldSchema, projectSchema, workflowSchema, workItemSchema } from '../types'

export const PROJECT_DB_NAME = 'MuonProjectDB'

export const PROJECT_DB_STORES = {
  projects: 'id, createdBy, createdAt, updatedAt',
  workItems:
    'id, projectId, parentId, type, status, priority, assignee, dueDate, order, createdAt, updatedAt, [projectId+status]',
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
  const saveProjectEffect = (project: Project): DesktopEffect<Project> =>
    Effect.gen(function* () {
      const parsed = projectSchema.parse(project)
      yield* fromPromise(() => db.projects.put(parsed))
      return parsed
    })

  const getProjectEffect = (id: string): DesktopEffect<Project | undefined> => fromPromise(() => db.projects.get(id))

  const listProjectsEffect = (): DesktopEffect<Project[]> =>
    fromPromise(() => db.projects.orderBy('updatedAt').reverse().toArray())

  const deleteProjectEffect = (id: string): DesktopEffect<void> =>
    fromPromise(() =>
      db.transaction('rw', db.projects, db.workItems, db.workflows, db.customFields, () =>
        db.projects
          .delete(id)
          .then(() => db.workItems.where('projectId').equals(id).delete())
          .then(() => db.workflows.where('projectId').equals(id).delete())
          .then(() => db.customFields.where('projectId').equals(id).delete()),
      ),
    )

  const saveWorkItemEffect = (item: WorkItem): DesktopEffect<WorkItem> =>
    Effect.gen(function* () {
      const parsed = workItemSchema.parse(item)
      yield* fromPromise(() => db.workItems.put(parsed))
      return parsed
    })

  const getWorkItemEffect = (id: string): DesktopEffect<WorkItem | undefined> => fromPromise(() => db.workItems.get(id))

  const listWorkItemsEffect = (projectId: string): DesktopEffect<WorkItem[]> =>
    fromPromise(() => db.workItems.where('projectId').equals(projectId).sortBy('order'))

  const listWorkItemsByStatusEffect = (projectId: string, status: string): DesktopEffect<WorkItem[]> =>
    fromPromise(() => db.workItems.where('[projectId+status]').equals([projectId, status]).sortBy('order'))

  const updateWorkItemEffect = (id: string, changes: Partial<WorkItem>): DesktopEffect<WorkItem> =>
    Effect.gen(function* () {
      const existing = yield* getWorkItemEffect(id)
      if (!existing) {
        return yield* fromSync(() => {
          throw new Error(`WorkItem ${id} not found`)
        })
      }
      const updated = workItemSchema.parse({ ...existing, ...changes, updatedAt: Date.now() })
      yield* fromPromise(() => db.workItems.update(id, updated))
      return updated
    })

  const deleteWorkItemEffect = (id: string): DesktopEffect<void> => fromPromise(() => db.workItems.delete(id))

  const reorderWorkItemEffect = (id: string, newOrder: number, status: string): DesktopEffect<WorkItem> =>
    Effect.gen(function* () {
      const existing = yield* getWorkItemEffect(id)
      if (!existing) {
        return yield* fromSync(() => {
          throw new Error(`WorkItem ${id} not found`)
        })
      }
      const updated = workItemSchema.parse({ ...existing, order: newOrder, status, updatedAt: Date.now() })
      yield* fromPromise(() => db.workItems.update(id, updated))
      return updated
    })

  const saveWorkflowEffect = (workflow: Workflow): DesktopEffect<Workflow> =>
    Effect.gen(function* () {
      const parsed = workflowSchema.parse(workflow)
      yield* fromPromise(() => db.workflows.put(parsed))
      return parsed
    })

  const getWorkflowEffect = (projectId: string): DesktopEffect<Workflow | undefined> =>
    fromPromise(() => db.workflows.where('projectId').equals(projectId).first())

  const saveCustomFieldEffect = (field: CustomField): DesktopEffect<CustomField> =>
    Effect.gen(function* () {
      const parsed = customFieldSchema.parse(field)
      yield* fromPromise(() => db.customFields.put(parsed))
      return parsed
    })

  const listCustomFieldsEffect = (projectId: string): DesktopEffect<CustomField[]> =>
    fromPromise(() => db.customFields.where('projectId').equals(projectId).sortBy('order'))

  const deleteCustomFieldEffect = (id: string): DesktopEffect<void> => fromPromise(() => db.customFields.delete(id))

  return {
    saveProjectEffect,
    getProjectEffect,
    listProjectsEffect,
    deleteProjectEffect,
    saveWorkItemEffect,
    getWorkItemEffect,
    listWorkItemsEffect,
    listWorkItemsByStatusEffect,
    updateWorkItemEffect,
    deleteWorkItemEffect,
    reorderWorkItemEffect,
    saveWorkflowEffect,
    getWorkflowEffect,
    saveCustomFieldEffect,
    listCustomFieldsEffect,
    deleteCustomFieldEffect,
    // ---- Projects ----
    saveProject(project: Project) {
      return runDesktopEffect(saveProjectEffect(project))
    },

    getProject(id: string) {
      return runDesktopEffect(getProjectEffect(id))
    },

    listProjects() {
      return runDesktopEffect(listProjectsEffect())
    },

    deleteProject(id: string) {
      return runDesktopEffect(deleteProjectEffect(id))
    },

    // ---- Work Items ----
    saveWorkItem(item: WorkItem) {
      return runDesktopEffect(saveWorkItemEffect(item))
    },

    getWorkItem(id: string) {
      return runDesktopEffect(getWorkItemEffect(id))
    },

    listWorkItems(projectId: string) {
      return runDesktopEffect(listWorkItemsEffect(projectId))
    },

    listWorkItemsByStatus(projectId: string, status: string) {
      return runDesktopEffect(listWorkItemsByStatusEffect(projectId, status))
    },

    updateWorkItem(id: string, changes: Partial<WorkItem>) {
      return runDesktopEffect(updateWorkItemEffect(id, changes))
    },

    deleteWorkItem(id: string) {
      return runDesktopEffect(deleteWorkItemEffect(id))
    },

    reorderWorkItem(id: string, newOrder: number, status: string) {
      return runDesktopEffect(reorderWorkItemEffect(id, newOrder, status))
    },

    // ---- Workflows ----
    saveWorkflow(workflow: Workflow) {
      return runDesktopEffect(saveWorkflowEffect(workflow))
    },

    getWorkflow(projectId: string) {
      return runDesktopEffect(getWorkflowEffect(projectId))
    },

    // ---- Custom Fields ----
    saveCustomField(field: CustomField) {
      return runDesktopEffect(saveCustomFieldEffect(field))
    },

    listCustomFields(projectId: string) {
      return runDesktopEffect(listCustomFieldsEffect(projectId))
    },

    deleteCustomField(id: string) {
      return runDesktopEffect(deleteCustomFieldEffect(id))
    },
  }
}

export const projectRepo = createProjectRepository()
