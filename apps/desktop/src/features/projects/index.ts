export { projectStore, resetProjectStore, setCurrentProject } from './composables/useProjectStore'
export { useWorkflow } from './composables/useWorkflow'
export {
  applyRemoteSync,
  createItem,
  deleteItem,
  loadItems,
  reorderItem,
  resetWorkItemStore,
  selectCurrentItems,
  setCurrentProject as setWorkItemCurrentProject,
  setWorkItems,
  subscribeToRemoteSync,
  unsubscribeFromRemoteSync,
  updateItem,
  workItemStore,
} from './composables/useWorkItemStore'
export { projectRepo } from './db/projectDb'
// src/features/projects/index.ts
export { default as ProjectsPage } from './ProjectsPage.vue'
export { useCreateProject, useDeleteProject, useProjectsQuery, useUpdateProject } from './queries/useProjects'
export * from './types'
