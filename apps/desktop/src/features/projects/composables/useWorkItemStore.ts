import type { WorkItem } from '../types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getClient } from '@/matrix/client'
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
    } finally {
      loading.value = false
    }
  }

  async function createItem(
    projectId: string,
    data: {
      title: string
      description?: string
      status: string
      type?: WorkItem['type']
      priority?: WorkItem['priority']
      assignee?: string
      dueDate?: number
      parentId?: string
    },
  ): Promise<WorkItem> {
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
    } else {
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
      }).catch(() => {
        /* sync is best-effort */
      })
    }

    return item
  }

  async function updateItem(id: string, changes: Partial<WorkItem>): Promise<WorkItem> {
    const updated = await projectRepo.updateWorkItem(id, changes)
    const list = itemsByProject.value[updated.projectId]
    if (list) {
      const idx = list.findIndex((i) => i.id === id)
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
      itemsByProject.value[projectId] = list.filter((i) => i.id !== id)
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
      const idx = list.findIndex((i) => i.id === id)
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
