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
