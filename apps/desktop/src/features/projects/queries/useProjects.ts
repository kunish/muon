import type { Project } from '../types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { projectKeys } from './projectKeys'
import {
  createProjectEntry,
  deleteProjectEntry,
  loadProjects,
  prependProject,
  removeProject,
  replaceProject,
  updateProjectEntry,
} from './projectsApi'

export function useProjectsQuery() {
  const query = useQuery({
    queryKey: projectKeys.list(),
    queryFn: loadProjects,
  })
  const projects = computed(() => query.data.value ?? [])
  // Spread the query so callers can reach isLoading/refetch; `projects` is a
  // convenience computed so call sites avoid `data.value ?? []`.
  return { ...query, projects }
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProjectEntry,
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(projectKeys.list(), (prev) => prependProject(prev ?? [], project))
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<Project> }) => updateProjectEntry(id, changes),
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(projectKeys.list(), (prev) => replaceProject(prev ?? [], project))
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProjectEntry,
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Project[]>(projectKeys.list(), (prev) => removeProject(prev ?? [], id))
    },
  })
}
