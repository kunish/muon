import type { PersistedCustomApp } from '@/features/workplace/stores/workplaceStore'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  addCustomApp,
  hideApp,
  resetWorkplaceStore,
  setOrder,
  updateCustomApp,
  WORKPLACE_STORAGE_KEY,
  workplaceStore,
} from '@/features/workplace/stores/workplaceStore'

describe('workplaceStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetWorkplaceStore()
  })

  it('starts with empty state by default', () => {
    expect(workplaceStore.state.hiddenAppIds).toEqual([])
    expect(workplaceStore.state.appOrder).toEqual([])
    expect(workplaceStore.state.customApps).toEqual([])
  })

  it('addCustomApp prepends the new app to customApps', () => {
    const first: PersistedCustomApp = { id: 'app-1', name: 'App One', desc: 'First', category: 'productivity' }
    const second: PersistedCustomApp = { id: 'app-2', name: 'App Two', desc: 'Second', category: 'engineering' }
    addCustomApp(first)
    addCustomApp(second)
    expect(workplaceStore.state.customApps.map((a: PersistedCustomApp) => a.id)).toEqual(['app-2', 'app-1'])
  })

  it('updateCustomApp patches the matching app by id and leaves others unchanged', () => {
    const app: PersistedCustomApp = { id: 'app-1', name: 'Old Name', desc: 'Old Desc', category: 'operations' }
    addCustomApp(app)
    updateCustomApp('app-1', { name: 'New Name', desc: 'New Desc' })
    const updated = workplaceStore.state.customApps.find((a: PersistedCustomApp) => a.id === 'app-1')
    expect(updated?.name).toBe('New Name')
    expect(updated?.desc).toBe('New Desc')
    expect(updated?.category).toBe('operations')
  })

  it('hideApp adds the id and deduplicates on repeated calls', () => {
    hideApp('calendar')
    hideApp('calendar')
    hideApp('meet')
    expect(workplaceStore.state.hiddenAppIds).toEqual(['calendar', 'meet'])
  })

  it('setOrder replaces appOrder', () => {
    setOrder(['meet', 'calendar', 'tasks'])
    expect(workplaceStore.state.appOrder).toEqual(['meet', 'calendar', 'tasks'])
    setOrder(['tasks'])
    expect(workplaceStore.state.appOrder).toEqual(['tasks'])
  })

  it('persists to localStorage with correct key and shape after each action', () => {
    const app: PersistedCustomApp = { id: 'app-1', name: 'Test', desc: 'Desc', category: 'productivity' }
    addCustomApp(app)
    hideApp('calendar')
    setOrder(['app-1', 'calendar'])

    const raw = localStorage.getItem(WORKPLACE_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const stored = JSON.parse(raw!)
    expect(stored.version).toBe(1)
    expect(stored.customApps).toHaveLength(1)
    expect(stored.customApps[0].id).toBe('app-1')
    expect(stored.hiddenAppIds).toContain('calendar')
    expect(stored.appOrder).toEqual(['app-1', 'calendar'])
  })

  it('hydrates state from localStorage when resetWorkplaceStore is called', () => {
    const app: PersistedCustomApp = { id: 'hydrated-app', name: 'Hydrated', desc: 'From storage', category: 'design' }
    addCustomApp(app)
    hideApp('meet')
    setOrder(['hydrated-app'])

    // Simulate reload: reset re-reads from localStorage
    resetWorkplaceStore()

    expect(workplaceStore.state.customApps.map((a: PersistedCustomApp) => a.id)).toEqual(['hydrated-app'])
    expect(workplaceStore.state.hiddenAppIds).toContain('meet')
    expect(workplaceStore.state.appOrder).toEqual(['hydrated-app'])
  })
})
