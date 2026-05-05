// src/features/projects/index.ts
export { default as ProjectsPage } from './ProjectsPage.vue'
export { useProjectStore } from './composables/useProjectStore'
export { useWorkItemStore } from './composables/useWorkItemStore'
export { useWorkflow } from './composables/useWorkflow'
export { projectRepo } from './db/projectDb'
export * from './types'
