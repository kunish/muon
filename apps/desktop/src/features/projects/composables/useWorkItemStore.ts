import type { WorkItem } from '../types'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getClient } from '@/matrix/client'
import { sendProjectSyncEvent } from '@/matrix/projects'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
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

  function loadItemsEffect(projectId: string): DesktopEffect<void> {
    return Effect.gen(function* () {
      yield* fromSync(() => {
        loading.value = true
      })
      const items = yield* fromPromise(() => projectRepo.listWorkItems(projectId))
      yield* fromSync(() => {
        itemsByProject.value[projectId] = items
      })
    }).pipe(Effect.ensuring(Effect.sync(() => void (loading.value = false))))
  }

  function loadItems(projectId: string) {
    return runDesktopEffect(loadItemsEffect(projectId))
  }

  function sendWorkItemSyncEffect(
    projectId: string,
    payload: Parameters<typeof sendProjectSyncEvent>[1],
  ): DesktopEffect<void> {
    return fromPromise(() => sendProjectSyncEvent(projectId, payload)).pipe(Effect.catchAll(() => Effect.void))
  }

  function createItemEffect(
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
  ): DesktopEffect<WorkItem> {
    return Effect.gen(function* () {
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

      yield* fromPromise(() => projectRepo.saveWorkItem(item))
      yield* fromSync(() => {
        if (itemsByProject.value[projectId]) {
          itemsByProject.value[projectId].push(item)
        } else {
          itemsByProject.value[projectId] = [item]
        }
      })

      // Sync via Matrix
      const client = getClient()
      yield* sendWorkItemSyncEffect(projectId, {
        type: 'muon.project.workitem.create',
        projectId,
        ts: now,
        sender: client.getUserId()!,
        data: { workItemId: item.id, workItem: item },
      })

      return item
    })
  }

  function createItem(
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
    return runDesktopEffect(createItemEffect(projectId, data))
  }

  function updateItemEffect(id: string, changes: Partial<WorkItem>): DesktopEffect<WorkItem> {
    return Effect.gen(function* () {
      const updated = yield* fromPromise(() => projectRepo.updateWorkItem(id, changes))
      yield* fromSync(() => {
        const list = itemsByProject.value[updated.projectId]
        if (list) {
          const idx = list.findIndex((i) => i.id === id)
          if (idx !== -1) list.splice(idx, 1, updated)
        }
      })

      const client = getClient()
      yield* sendWorkItemSyncEffect(updated.projectId, {
        type: 'muon.project.workitem.update',
        projectId: updated.projectId,
        ts: Date.now(),
        sender: client.getUserId()!,
        data: { workItemId: id, changes },
      })

      return updated
    })
  }

  function updateItem(id: string, changes: Partial<WorkItem>): Promise<WorkItem> {
    return runDesktopEffect(updateItemEffect(id, changes))
  }

  function deleteItemEffect(id: string, projectId: string): DesktopEffect<void> {
    return Effect.gen(function* () {
      yield* fromPromise(() => projectRepo.deleteWorkItem(id))
      yield* fromSync(() => {
        const list = itemsByProject.value[projectId]
        if (list) {
          itemsByProject.value[projectId] = list.filter((i) => i.id !== id)
        }
      })

      const client = getClient()
      yield* sendWorkItemSyncEffect(projectId, {
        type: 'muon.project.workitem.delete',
        projectId,
        ts: Date.now(),
        sender: client.getUserId()!,
        data: { workItemId: id },
      })
    })
  }

  function deleteItem(id: string, projectId: string) {
    return runDesktopEffect(deleteItemEffect(id, projectId))
  }

  function reorderItemEffect(
    id: string,
    projectId: string,
    newOrder: number,
    statusColumn: string,
  ): DesktopEffect<WorkItem> {
    return Effect.gen(function* () {
      const updated = yield* fromPromise(() => projectRepo.reorderWorkItem(id, newOrder, statusColumn))
      yield* fromSync(() => {
        const list = itemsByProject.value[projectId]
        if (list) {
          const idx = list.findIndex((i) => i.id === id)
          if (idx !== -1) list.splice(idx, 1, updated)
        }
      })

      const client = getClient()
      yield* sendWorkItemSyncEffect(projectId, {
        type: 'muon.project.workitem.reorder',
        projectId,
        ts: Date.now(),
        sender: client.getUserId()!,
        data: { workItemId: id, newOrder, statusColumn },
      })

      return updated
    })
  }

  function reorderItem(id: string, projectId: string, newOrder: number, statusColumn: string) {
    return runDesktopEffect(reorderItemEffect(id, projectId, newOrder, statusColumn))
  }

  function setCurrentProjectEffect(projectId: string | null): DesktopEffect<void> {
    return fromSync(() => {
      currentProjectId.value = projectId
    })
  }

  function setCurrentProject(projectId: string | null) {
    runDesktopSync(setCurrentProjectEffect(projectId))
  }

  return {
    itemsByProject,
    loading,
    currentProjectId,
    currentItems,
    itemsByStatus,
    loadItemsEffect,
    createItemEffect,
    updateItemEffect,
    deleteItemEffect,
    reorderItemEffect,
    setCurrentProjectEffect,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    reorderItem,
    setCurrentProject,
  }
})
