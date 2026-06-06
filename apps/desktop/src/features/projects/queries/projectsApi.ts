import type { Project, ProjectTemplate, ProjectVisibility } from '../types'
import { Preset } from 'matrix-js-sdk'
import { getClient } from '@/matrix/client'
import { projectRepo } from '../db/projectDb'
import { projectSchema } from '../types'

export interface CreateProjectInput {
  name: string
  description?: string
  visibility?: ProjectVisibility
  template?: ProjectTemplate
}

export async function loadProjects(): Promise<Project[]> {
  return projectRepo.listProjects()
}

export async function createProjectEntry(data: CreateProjectInput): Promise<Project> {
  const client = getClient()
  const userId = client.getUserId()!

  // Create the backing Matrix room for the project.
  const { room_id: roomId } = await client.createRoom({
    name: data.name,
    topic: data.description ?? '',
    preset: data.visibility === 'public' ? Preset.PublicChat : Preset.PrivateChat,
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
  return project
}

export async function updateProjectEntry(id: string, changes: Partial<Project>): Promise<Project> {
  const existing = await projectRepo.getProject(id)
  if (!existing) throw new Error(`Project ${id} not found`)

  const updated = projectSchema.parse({ ...existing, ...changes, updatedAt: Date.now() })
  const client = getClient()

  // Only push to Matrix when the room-visible fields actually changed.
  if (changes.name !== undefined && updated.name !== existing.name) await client.setRoomName(id, updated.name)
  if (changes.description !== undefined && updated.description !== existing.description)
    await client.setRoomTopic(id, updated.description)

  await projectRepo.saveProject(updated)
  return updated
}

export async function deleteProjectEntry(id: string): Promise<void> {
  const client = getClient()
  await client.leave(id)
  await projectRepo.deleteProject(id)
}

export function prependProject(list: Project[], project: Project): Project[] {
  return [project, ...list]
}

export function replaceProject(list: Project[], project: Project): Project[] {
  return list.map((item) => (item.id === project.id ? project : item))
}

export function removeProject(list: Project[], id: string): Project[] {
  return list.filter((item) => item.id !== id)
}
