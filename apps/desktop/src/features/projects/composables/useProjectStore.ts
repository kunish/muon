import type { Project, ProjectTemplate, ProjectVisibility } from '../types'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { Preset } from 'matrix-js-sdk'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getClient } from '@/matrix/client'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { projectRepo } from '../db/projectDb'
import { projectSchema } from '../types'

export const useProjectStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const currentProjectId = ref<string | null>(null)

  function loadProjectsEffect(): DesktopEffect<void> {
    return Effect.gen(function* () {
      yield* fromSync(() => {
        loading.value = true
      })
      const nextProjects = yield* fromPromise(() => projectRepo.listProjects())
      yield* fromSync(() => {
        projects.value = nextProjects
      })
    }).pipe(Effect.ensuring(Effect.sync(() => void (loading.value = false))))
  }

  function loadProjects() {
    return runDesktopEffect(loadProjectsEffect())
  }

  function createProjectEffect(data: {
    name: string
    description?: string
    visibility?: ProjectVisibility
    template?: ProjectTemplate
  }): DesktopEffect<Project> {
    return Effect.gen(function* () {
      const client = getClient()
      const userId = client.getUserId()!

      // Create Matrix room for the project
      const { room_id: roomId } = yield* fromPromise(() =>
        client.createRoom({
          name: data.name,
          topic: data.description ?? '',
          preset: data.visibility === 'public' ? Preset.PublicChat : Preset.PrivateChat,
        }),
      )

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

      yield* fromPromise(() => projectRepo.saveProject(project))
      yield* fromSync(() => projects.value.unshift(project))
      return project
    })
  }

  function createProject(data: {
    name: string
    description?: string
    visibility?: ProjectVisibility
    template?: ProjectTemplate
  }): Promise<Project> {
    return runDesktopEffect(createProjectEffect(data))
  }

  function updateProjectEffect(id: string, changes: Partial<Project>): DesktopEffect<Project> {
    return Effect.gen(function* () {
      const existing = yield* fromPromise(() => projectRepo.getProject(id))
      if (!existing) {
        return yield* fromSync(() => {
          throw new Error(`Project ${id} not found`)
        })
      }

      const updated = projectSchema.parse({ ...existing, ...changes, updatedAt: Date.now() })
      const client = getClient()

      if (changes.name !== undefined && updated.name !== existing.name)
        yield* fromPromise(() => client.setRoomName(id, updated.name))
      if (changes.description !== undefined && updated.description !== existing.description)
        yield* fromPromise(() => client.setRoomTopic(id, updated.description))

      yield* fromPromise(() => projectRepo.saveProject(updated))

      yield* fromSync(() => {
        const idx = projects.value.findIndex((p) => p.id === id)
        if (idx !== -1) projects.value.splice(idx, 1, updated)
      })

      return updated
    })
  }

  function updateProject(id: string, changes: Partial<Project>): Promise<Project> {
    return runDesktopEffect(updateProjectEffect(id, changes))
  }

  function deleteProjectEffect(id: string): DesktopEffect<void> {
    return Effect.gen(function* () {
      const client = getClient()
      yield* fromPromise(() => client.leave(id))
      yield* fromPromise(() => projectRepo.deleteProject(id))
      yield* fromSync(() => {
        projects.value = projects.value.filter((p) => p.id !== id)
      })
    })
  }

  function deleteProject(id: string) {
    return runDesktopEffect(deleteProjectEffect(id))
  }

  function setCurrentProjectEffect(id: string | null): DesktopEffect<void> {
    return fromSync(() => {
      currentProjectId.value = id
    })
  }

  function setCurrentProject(id: string | null) {
    runDesktopSync(setCurrentProjectEffect(id))
  }

  return {
    projects,
    loading,
    currentProjectId,
    loadProjectsEffect,
    createProjectEffect,
    updateProjectEffect,
    deleteProjectEffect,
    setCurrentProjectEffect,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    setCurrentProject,
  }
})
