import type { EntityTable } from 'dexie'
import type { CustomField, Project, Workflow, WorkItem } from '../types'
import Dexie from 'dexie'
import { customFieldSchema, projectSchema, workflowSchema, workItemSchema } from '../types'

export const PROJECT_DB_NAME = 'MuonProjectDB'

export const PROJECT_DB_STORES = {
  projects: 'id, createdBy, createdAt, updatedAt',
  workItems: 'id, projectId, parentId, type, status, priority, assignee, dueDate, order, createdAt, updatedAt, [projectId+status]',
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
      await db.transaction('rw', db.projects, db.workItems, db.workflows, db.customFields, async () => {
        await db.projects.delete(id)
        await db.workItems.where('projectId').equals(id).delete()
        await db.workflows.where('projectId').equals(id).delete()
        await db.customFields.where('projectId').equals(id).delete()
      })
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
        .where('projectId')
        .equals(projectId)
        .sortBy('order')
    },

    async listWorkItemsByStatus(projectId: string, status: string) {
      return db.workItems
        .where('[projectId+status]')
        .equals([projectId, status])
        .sortBy('order')
    },

    async updateWorkItem(id: string, changes: Partial<WorkItem>) {
      const existing = await db.workItems.get(id)
      if (!existing)
        throw new Error(`WorkItem ${id} not found`)
      const updated = workItemSchema.parse({ ...existing, ...changes, updatedAt: Date.now() })
      await db.workItems.update(id, updated)
      return updated
    },

    async deleteWorkItem(id: string) {
      await db.workItems.delete(id)
    },

    async reorderWorkItem(id: string, newOrder: number, status: string) {
      const existing = await db.workItems.get(id)
      if (!existing)
        throw new Error(`WorkItem ${id} not found`)
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
        .where('projectId')
        .equals(projectId)
        .sortBy('order')
    },

    async deleteCustomField(id: string) {
      await db.customFields.delete(id)
    },
  }
}

export const projectRepo = createProjectRepository()
