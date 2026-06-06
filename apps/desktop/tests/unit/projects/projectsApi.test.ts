import type { Project } from '@/features/projects/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createProjectEntry,
  deleteProjectEntry,
  loadProjects,
  prependProject,
  removeProject,
  replaceProject,
  updateProjectEntry,
} from '@/features/projects/queries/projectsApi'

const matrixClientMock = vi.hoisted(() => ({
  getUserId: vi.fn(() => '@me:localhost'),
  createRoom: vi.fn(),
  setRoomName: vi.fn(),
  setRoomTopic: vi.fn(),
  leave: vi.fn(),
}))

const projectRepoMock = vi.hoisted(() => ({
  getProject: vi.fn(),
  listProjects: vi.fn(),
  saveProject: vi.fn(),
  deleteProject: vi.fn(),
}))

vi.mock('@/matrix/client', () => ({ getClient: () => matrixClientMock }))
vi.mock('@/features/projects/db/projectDb', () => ({ projectRepo: projectRepoMock }))

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name: '项目',
    description: '描述',
    icon: 'folder-kanban',
    color: '#6366f1',
    visibility: 'team',
    template: 'kanban',
    createdBy: '@me:localhost',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as Project
}

beforeEach(() => {
  matrixClientMock.getUserId.mockReturnValue('@me:localhost')
  matrixClientMock.createRoom.mockReset()
  matrixClientMock.setRoomName.mockReset().mockResolvedValue(undefined)
  matrixClientMock.setRoomTopic.mockReset().mockResolvedValue(undefined)
  matrixClientMock.leave.mockReset().mockResolvedValue(undefined)
  projectRepoMock.getProject.mockReset()
  projectRepoMock.listProjects.mockReset().mockResolvedValue([])
  projectRepoMock.saveProject.mockReset().mockImplementation((p) => Promise.resolve(p))
  projectRepoMock.deleteProject.mockReset().mockResolvedValue(undefined)
})

describe('projectsApi', () => {
  it('loadProjects returns the repo project list', async () => {
    projectRepoMock.listProjects.mockResolvedValue([project('!a:localhost')])
    expect((await loadProjects()).map((p) => p.id)).toEqual(['!a:localhost'])
  })

  it('createProjectEntry creates a Matrix room, persists, and returns the project', async () => {
    matrixClientMock.createRoom.mockResolvedValue({ room_id: '!new:localhost' })

    const created = await createProjectEntry({ name: '新项目', description: 'desc', visibility: 'public' })

    expect(matrixClientMock.createRoom).toHaveBeenCalledWith(expect.objectContaining({ name: '新项目', topic: 'desc' }))
    expect(created.id).toBe('!new:localhost')
    expect(created.name).toBe('新项目')
    expect(projectRepoMock.saveProject).toHaveBeenCalledWith(expect.objectContaining({ id: '!new:localhost' }))
  })

  it('updateProjectEntry syncs name and description changes to the Matrix room', async () => {
    projectRepoMock.getProject.mockResolvedValue(
      project('!project:localhost', { name: '旧项目', description: '旧描述' }),
    )

    const updated = await updateProjectEntry('!project:localhost', { name: '新项目', description: '新的项目描述' })

    expect(matrixClientMock.setRoomName).toHaveBeenCalledWith('!project:localhost', '新项目')
    expect(matrixClientMock.setRoomTopic).toHaveBeenCalledWith('!project:localhost', '新的项目描述')
    expect(projectRepoMock.saveProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: '!project:localhost', name: '新项目', description: '新的项目描述' }),
    )
    expect(updated.name).toBe('新项目')
  })

  it('updateProjectEntry does not rewrite Matrix metadata for local-only field changes', async () => {
    projectRepoMock.getProject.mockResolvedValue(project('!project:localhost'))

    await updateProjectEntry('!project:localhost', { visibility: 'public' })

    expect(matrixClientMock.setRoomName).not.toHaveBeenCalled()
    expect(matrixClientMock.setRoomTopic).not.toHaveBeenCalled()
  })

  it('updateProjectEntry throws when the project is missing', async () => {
    projectRepoMock.getProject.mockResolvedValue(undefined)
    await expect(updateProjectEntry('!missing:localhost', { name: 'x' })).rejects.toThrow('not found')
  })

  it('deleteProjectEntry leaves the room and removes the project from the repo', async () => {
    await deleteProjectEntry('!project:localhost')
    expect(matrixClientMock.leave).toHaveBeenCalledWith('!project:localhost')
    expect(projectRepoMock.deleteProject).toHaveBeenCalledWith('!project:localhost')
  })

  it('cache helpers prepend, replace and remove by id', () => {
    const a = project('!a:localhost')
    const b = project('!b:localhost')
    expect(prependProject([b], a).map((p) => p.id)).toEqual(['!a:localhost', '!b:localhost'])
    expect(
      replaceProject([a, b], project('!b:localhost', { name: 'B2' })).find((p) => p.id === '!b:localhost')?.name,
    ).toBe('B2')
    expect(removeProject([a, b], '!a:localhost').map((p) => p.id)).toEqual(['!b:localhost'])
  })
})
