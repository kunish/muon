import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectStore } from '@/features/projects/composables/useProjectStore'

const matrixClientMock = vi.hoisted(() => ({
  setRoomName: vi.fn(),
  setRoomTopic: vi.fn(),
}))

const projectRepoMock = vi.hoisted(() => ({
  getProject: vi.fn(),
  listProjects: vi.fn(),
  saveProject: vi.fn(),
}))

vi.mock('@/matrix', () => ({
  getClient: () => matrixClientMock,
}))

vi.mock('@/features/projects/db/projectDb', () => ({
  projectRepo: projectRepoMock,
}))

describe('projectStore', () => {
  beforeEach(() => {
    matrixClientMock.setRoomName.mockReset()
    matrixClientMock.setRoomName.mockResolvedValue(undefined)
    matrixClientMock.setRoomTopic.mockReset()
    matrixClientMock.setRoomTopic.mockResolvedValue(undefined)
    projectRepoMock.getProject.mockReset()
    projectRepoMock.listProjects.mockReset()
    projectRepoMock.saveProject.mockReset()
    projectRepoMock.saveProject.mockImplementation(project => Promise.resolve(project))
  })

  it('syncs project name and description updates to the Matrix room', async () => {
    projectRepoMock.getProject.mockResolvedValue({
      id: '!project:localhost',
      name: '旧项目',
      description: '旧描述',
      icon: 'folder-kanban',
      color: '#6366f1',
      visibility: 'team',
      template: 'kanban',
      createdBy: '@me:localhost',
      createdAt: 1,
      updatedAt: 1,
    })

    const store = useProjectStore()

    const updated = await store.updateProject('!project:localhost', {
      name: '新项目',
      description: '新的项目描述',
    })

    expect(matrixClientMock.setRoomName).toHaveBeenCalledWith('!project:localhost', '新项目')
    expect(matrixClientMock.setRoomTopic).toHaveBeenCalledWith('!project:localhost', '新的项目描述')
    expect(projectRepoMock.saveProject).toHaveBeenCalledWith(expect.objectContaining({
      id: '!project:localhost',
      name: '新项目',
      description: '新的项目描述',
    }))
    expect(updated.name).toBe('新项目')
  })

  it('does not rewrite Matrix room metadata when local-only project fields change', async () => {
    projectRepoMock.getProject.mockResolvedValue({
      id: '!project:localhost',
      name: '项目',
      description: '描述',
      icon: 'folder-kanban',
      color: '#6366f1',
      visibility: 'team',
      template: 'kanban',
      createdBy: '@me:localhost',
      createdAt: 1,
      updatedAt: 1,
    })

    const store = useProjectStore()

    await store.updateProject('!project:localhost', {
      visibility: 'public',
    })

    expect(matrixClientMock.setRoomName).not.toHaveBeenCalled()
    expect(matrixClientMock.setRoomTopic).not.toHaveBeenCalled()
  })
})
