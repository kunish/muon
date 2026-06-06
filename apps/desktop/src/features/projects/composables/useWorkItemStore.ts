import type { MatrixEvent } from 'matrix-js-sdk'
import type { ProjectSyncPayload, WorkItem } from '../types'
import { Store } from '@tanstack/vue-store'
import { RoomEvent } from 'matrix-js-sdk'
import { getClient } from '@/matrix/client'
import { isProjectSyncEvent, parseProjectSyncPayload, sendProjectSyncEvent } from '@/matrix/projects'
import { projectRepo } from '../db/projectDb'
import { workItemSchema } from '../types'

function generateId(): string {
  return crypto.randomUUID()
}

type ItemsByProject = Record<string, WorkItem[]>

export interface WorkItemState {
  itemsByProject: ItemsByProject
  currentProjectId: string | null
}

function createInitialState(): WorkItemState {
  return { itemsByProject: {}, currentProjectId: null }
}

export const workItemStore = new Store<WorkItemState>(createInitialState())

// ── Pure selectors / map helpers ────────────────────────────────────────────

export function selectCurrentItems(state: WorkItemState): WorkItem[] {
  if (!state.currentProjectId) return []
  return state.itemsByProject[state.currentProjectId] ?? []
}

function withItems(map: ItemsByProject, projectId: string, items: WorkItem[]): ItemsByProject {
  return { ...map, [projectId]: items }
}

/** Add or replace an item in its project bucket (used by inbound remote sync). */
function upsertItem(map: ItemsByProject, projectId: string, item: WorkItem): ItemsByProject {
  const list = map[projectId] ?? []
  const idx = list.findIndex((i) => i.id === item.id)
  const next = idx === -1 ? [...list, item] : list.map((i) => (i.id === item.id ? item : i))
  return { ...map, [projectId]: next }
}

/** Replace an item only if it is already present (used by outbound update/reorder). */
function replaceItemIfPresent(map: ItemsByProject, projectId: string, item: WorkItem): ItemsByProject {
  const list = map[projectId]
  if (!list || !list.some((i) => i.id === item.id)) return map
  return { ...map, [projectId]: list.map((i) => (i.id === item.id ? item : i)) }
}

function removeItemFromMap(map: ItemsByProject, projectId: string, id: string): ItemsByProject {
  const list = map[projectId]
  if (!list) return map
  return { ...map, [projectId]: list.filter((i) => i.id !== id) }
}

// ── Client state mutators ────────────────────────────────────────────────────

export function setCurrentProject(projectId: string | null) {
  workItemStore.setState((s) => ({ ...s, currentProjectId: projectId }))
}

export function setWorkItems(projectId: string, items: WorkItem[]) {
  workItemStore.setState((s) => ({ ...s, itemsByProject: withItems(s.itemsByProject, projectId, items) }))
}

export async function loadItems(projectId: string) {
  const items = await projectRepo.listWorkItems(projectId)
  setWorkItems(projectId, items)
}

async function sendWorkItemSync(projectId: string, payload: Parameters<typeof sendProjectSyncEvent>[1]) {
  // Sync is best-effort: a failed broadcast must not fail the local mutation.
  try {
    await sendProjectSyncEvent(projectId, payload)
  } catch {
    /* swallow — local state already updated; peers reconcile on next sync */
  }
}

export async function createItem(
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
  const items = workItemStore.state.itemsByProject[projectId] ?? []
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
  workItemStore.setState((s) => ({ ...s, itemsByProject: upsertItem(s.itemsByProject, projectId, item) }))

  const client = getClient()
  await sendWorkItemSync(projectId, {
    type: 'muon.project.workitem.create',
    projectId,
    ts: now,
    sender: client.getUserId()!,
    data: { workItemId: item.id, workItem: item },
  })

  return item
}

export async function updateItem(id: string, changes: Partial<WorkItem>): Promise<WorkItem> {
  const updated = await projectRepo.updateWorkItem(id, changes)
  workItemStore.setState((s) => ({
    ...s,
    itemsByProject: replaceItemIfPresent(s.itemsByProject, updated.projectId, updated),
  }))

  const client = getClient()
  await sendWorkItemSync(updated.projectId, {
    type: 'muon.project.workitem.update',
    projectId: updated.projectId,
    ts: Date.now(),
    sender: client.getUserId()!,
    data: { workItemId: id, changes },
  })

  return updated
}

export async function deleteItem(id: string, projectId: string): Promise<void> {
  await projectRepo.deleteWorkItem(id)
  workItemStore.setState((s) => ({ ...s, itemsByProject: removeItemFromMap(s.itemsByProject, projectId, id) }))

  const client = getClient()
  await sendWorkItemSync(projectId, {
    type: 'muon.project.workitem.delete',
    projectId,
    ts: Date.now(),
    sender: client.getUserId()!,
    data: { workItemId: id },
  })
}

export async function reorderItem(
  id: string,
  projectId: string,
  newOrder: number,
  statusColumn: string,
): Promise<WorkItem> {
  const updated = await projectRepo.reorderWorkItem(id, newOrder, statusColumn)
  workItemStore.setState((s) => ({
    ...s,
    itemsByProject: replaceItemIfPresent(s.itemsByProject, projectId, updated),
  }))

  const client = getClient()
  await sendWorkItemSync(projectId, {
    type: 'muon.project.workitem.reorder',
    projectId,
    ts: Date.now(),
    sender: client.getUserId()!,
    data: { workItemId: id, newOrder, statusColumn },
  })

  return updated
}

// ── Inbound remote sync (apply muon.project.sync events from other clients) ──

async function applyRemoteSyncEntry(payload: ProjectSyncPayload): Promise<void> {
  const { projectId, data } = payload
  switch (payload.type) {
    case 'muon.project.workitem.create': {
      if (!data.workItem) return
      const item = workItemSchema.parse(data.workItem)
      await projectRepo.saveWorkItem(item)
      workItemStore.setState((s) => ({ ...s, itemsByProject: upsertItem(s.itemsByProject, item.projectId, item) }))
      return
    }
    case 'muon.project.workitem.update': {
      if (!data.workItemId || !data.changes) return
      const updated = await projectRepo.updateWorkItem(data.workItemId, data.changes)
      workItemStore.setState((s) => ({
        ...s,
        itemsByProject: upsertItem(s.itemsByProject, updated.projectId, updated),
      }))
      return
    }
    case 'muon.project.workitem.delete': {
      if (!data.workItemId) return
      await projectRepo.deleteWorkItem(data.workItemId)
      workItemStore.setState((s) => ({
        ...s,
        itemsByProject: removeItemFromMap(s.itemsByProject, projectId, data.workItemId!),
      }))
      return
    }
    case 'muon.project.workitem.reorder': {
      if (!data.workItemId || data.newOrder == null || !data.statusColumn) return
      const updated = await projectRepo.reorderWorkItem(data.workItemId, data.newOrder, data.statusColumn)
      workItemStore.setState((s) => ({
        ...s,
        itemsByProject: upsertItem(s.itemsByProject, updated.projectId, updated),
      }))
    }
  }
}

export function applyRemoteSync(payload: ProjectSyncPayload): void {
  // Ignore our own events (already applied locally) to avoid a write loop.
  if (payload.sender && payload.sender === getClient().getUserId()) return
  void applyRemoteSyncEntry(payload).catch((err) => {
    console.error('[workItemStore] remote sync apply failed:', err)
  })
}

let unsubscribeTimeline: (() => void) | null = null

export function subscribeToRemoteSync(): void {
  if (unsubscribeTimeline) return
  const client = getClient()
  const handler = (event: MatrixEvent): void => {
    if (!isProjectSyncEvent(event)) return
    const payload = parseProjectSyncPayload(event)
    if (payload) applyRemoteSync(payload)
  }
  client.on(RoomEvent.Timeline, handler)
  unsubscribeTimeline = () => client.off(RoomEvent.Timeline, handler)
}

export function unsubscribeFromRemoteSync(): void {
  unsubscribeTimeline?.()
  unsubscribeTimeline = null
}

export function resetWorkItemStore(): void {
  unsubscribeFromRemoteSync()
  workItemStore.setState(() => createInitialState())
}
