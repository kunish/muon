import { Store } from '@tanstack/vue-store'

export interface ProjectSelectionState {
  // Currently write-only across the app (the work-item store tracks its own
  // currentProjectId); kept as the projects feature's selection seam.
  currentProjectId: string | null
}

function createInitialState(): ProjectSelectionState {
  return { currentProjectId: null }
}

export const projectStore = new Store<ProjectSelectionState>(createInitialState())

export function setCurrentProject(id: string | null) {
  projectStore.setState((prev) => ({ ...prev, currentProjectId: id }))
}

export function resetProjectStore() {
  projectStore.setState(() => createInitialState())
}
