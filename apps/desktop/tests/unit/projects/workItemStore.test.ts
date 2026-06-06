import type { WorkItem } from '@/features/projects/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyRemoteSync,
  createItem,
  deleteItem,
  loadItems,
  reorderItem,
  resetWorkItemStore,
  selectCurrentItems,
  setCurrentProject,
  subscribeToRemoteSync,
  unsubscribeFromRemoteSync,
  updateItem,
  workItemStore,
} from '@/features/projects/composables/useWorkItemStore'

const repoMock = vi.hoisted(() => ({
  listWorkItems: vi.fn(),
  saveWorkItem: vi.fn(),
  updateWorkItem: vi.fn(),
  deleteWorkItem: vi.fn(),
  reorderWorkItem: vi.fn(),
}))
const sendProjectSyncEventMock = vi.hoisted(() => vi.fn())
const clientMock = vi.hoisted(() => ({ getUserId: vi.fn(() => '@me:localhost'), on: vi.fn(), off: vi.fn() }))

vi.mock('@/features/projects/db/projectDb', () => ({ projectRepo: repoMock }))
vi.mock('@/matrix/client', () => ({ getClient: () => clientMock }))
vi.mock('@/matrix/projects', () => ({
  sendProjectSyncEvent: (...args: unknown[]) => sendProjectSyncEventMock(...args),
  isProjectSyncEvent: () => false,
  parseProjectSyncPayload: () => null,
}))

const PID = '!project:localhost'

function item(id: string, overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id,
    projectId: PID,
    type: 'task',
    title: `Item ${id}`,
    description: '',
    status: 'todo',
    priority: 'none',
    order: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as WorkItem
}

beforeEach(() => {
  resetWorkItemStore()
  repoMock.listWorkItems.mockReset().mockResolvedValue([])
  repoMock.saveWorkItem.mockReset().mockResolvedValue(undefined)
  repoMock.updateWorkItem.mockReset()
  repoMock.deleteWorkItem.mockReset().mockResolvedValue(undefined)
  repoMock.reorderWorkItem.mockReset()
  sendProjectSyncEventMock.mockReset().mockResolvedValue(undefined)
  clientMock.getUserId.mockReturnValue('@me:localhost')
  clientMock.on.mockReset()
  clientMock.off.mockReset()
})

describe('workItemStore', () => {
  it('selectCurrentItems returns the current project bucket', () => {
    setCurrentProject(PID)
    setWorkItemsViaState([item('a')])
    expect(selectCurrentItems(workItemStore.state).map((i) => i.id)).toEqual(['a'])
  })

  it('loadItems fills the project bucket from the repo', async () => {
    repoMock.listWorkItems.mockResolvedValue([item('a'), item('b')])
    await loadItems(PID)
    expect(workItemStore.state.itemsByProject[PID].map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('createItem persists, appends locally with the next order, and broadcasts', async () => {
    setCurrentProject(PID)
    setWorkItemsViaState([item('a', { order: 0 })])

    const created = await createItem(PID, { title: '新任务', status: 'todo' })

    expect(repoMock.saveWorkItem).toHaveBeenCalledWith(expect.objectContaining({ title: '新任务', order: 1 }))
    expect(selectCurrentItems(workItemStore.state).map((i) => i.id)).toEqual(['a', created.id])
    expect(sendProjectSyncEventMock).toHaveBeenCalledWith(
      PID,
      expect.objectContaining({ type: 'muon.project.workitem.create' }),
    )
  })

  it('updateItem replaces an existing item but not an absent one', async () => {
    setCurrentProject(PID)
    setWorkItemsViaState([item('a', { title: 'old' })])
    repoMock.updateWorkItem.mockResolvedValue(item('a', { title: 'new' }))

    await updateItem('a', { title: 'new' })
    expect(selectCurrentItems(workItemStore.state)[0].title).toBe('new')

    repoMock.updateWorkItem.mockResolvedValue(item('ghost', { title: 'ghost' }))
    await updateItem('ghost', { title: 'ghost' })
    expect(selectCurrentItems(workItemStore.state).map((i) => i.id)).toEqual(['a'])
  })

  it('deleteItem removes locally and broadcasts', async () => {
    setCurrentProject(PID)
    setWorkItemsViaState([item('a'), item('b')])

    await deleteItem('a', PID)

    expect(selectCurrentItems(workItemStore.state).map((i) => i.id)).toEqual(['b'])
    expect(repoMock.deleteWorkItem).toHaveBeenCalledWith('a')
    expect(sendProjectSyncEventMock).toHaveBeenCalledWith(
      PID,
      expect.objectContaining({ type: 'muon.project.workitem.delete' }),
    )
  })

  it('reorderItem replaces the moved item from the repo result', async () => {
    setCurrentProject(PID)
    setWorkItemsViaState([item('a', { order: 0 }), item('b', { order: 1 })])
    repoMock.reorderWorkItem.mockResolvedValue(item('b', { order: 0, status: 'doing' }))

    await reorderItem('b', PID, 0, 'doing')

    expect(repoMock.reorderWorkItem).toHaveBeenCalledWith('b', 0, 'doing')
    expect(selectCurrentItems(workItemStore.state).find((i) => i.id === 'b')?.status).toBe('doing')
  })

  it('createItem still resolves when the matrix sync broadcast fails', async () => {
    sendProjectSyncEventMock.mockRejectedValue(new Error('offline'))
    await expect(createItem(PID, { title: 'x', status: 'todo' })).resolves.toMatchObject({ title: 'x' })
  })

  it('applyRemoteSync upserts a remote create and persists it', async () => {
    const remote = item('r1', { title: 'remote' })
    applyRemoteSync({
      type: 'muon.project.workitem.create',
      projectId: PID,
      ts: 1,
      sender: '@peer:localhost',
      data: { workItemId: 'r1', workItem: remote },
    } as never)
    await vi.waitFor(() => expect(repoMock.saveWorkItem).toHaveBeenCalled())
    expect(workItemStore.state.itemsByProject[PID]?.map((i) => i.id)).toContain('r1')
  })

  it('applyRemoteSync ignores events sent by the local user', () => {
    applyRemoteSync({
      type: 'muon.project.workitem.delete',
      projectId: PID,
      ts: 1,
      sender: '@me:localhost',
      data: { workItemId: 'a' },
    } as never)
    expect(repoMock.deleteWorkItem).not.toHaveBeenCalled()
  })

  it('subscribe/unsubscribe wire and tear down the timeline listener', () => {
    subscribeToRemoteSync()
    subscribeToRemoteSync()
    expect(clientMock.on).toHaveBeenCalledTimes(1)
    unsubscribeFromRemoteSync()
    expect(clientMock.off).toHaveBeenCalledTimes(1)
  })
})

function setWorkItemsViaState(items: WorkItem[]) {
  workItemStore.setState((s) => ({ ...s, itemsByProject: { ...s.itemsByProject, [PID]: items } }))
}
