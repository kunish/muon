import { beforeEach, describe, expect, it } from 'vitest'
import { projectStore, resetProjectStore, setCurrentProject } from '@/features/projects/composables/useProjectStore'

describe('projectStore (client selection)', () => {
  beforeEach(() => {
    resetProjectStore()
  })

  it('starts with no current project', () => {
    expect(projectStore.state.currentProjectId).toBeNull()
  })

  it('setCurrentProject records and clears the selection', () => {
    setCurrentProject('!project:localhost')
    expect(projectStore.state.currentProjectId).toBe('!project:localhost')
    setCurrentProject(null)
    expect(projectStore.state.currentProjectId).toBeNull()
  })

  it('resetProjectStore restores the initial state', () => {
    setCurrentProject('!project:localhost')
    resetProjectStore()
    expect(projectStore.state.currentProjectId).toBeNull()
  })
})
